const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PALAVRAS_SECRETAS, existeNoDicionario, normalizar } = require('./words');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── Utilitários ───────────────────────────────────────────────────────────────

function embaralhar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function gerarRodadas() {
  const palavrasSel = embaralhar(PALAVRAS_SECRETAS).slice(0, 10);
  return palavrasSel.map(palavra => ({ palavra, letraAtual: 0 }));
}

// ─── Estado das salas ──────────────────────────────────────────────────────────

const salas = {};

function criarSala(salaId) {
  const rodadas = gerarRodadas();
  salas[salaId] = {
    jogadores: [],
    rodadaAtual: 0,
    rodadas,
    turno: 0,
    fase: 'aguardando',
  };
  return salas[salaId];
}

function getRodadaInfo(sala) {
  const r = sala.rodadas[sala.rodadaAtual];
  return {
    prefixo: r.palavra.slice(0, r.letraAtual + 1),
    palavra: r.palavra,
    letraAtual: r.letraAtual,
    totalLetras: r.palavra.length,
  };
}

// ─── Socket.IO ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('Conectado:', socket.id);

  // ── Entrar na sala ─────────────────────────────────────────────────────────
  socket.on('entrar_sala', ({ salaId, nome }) => {
    if (!salas[salaId]) criarSala(salaId);
    const sala = salas[salaId];

    if (sala.jogadores.length >= 2) {
      socket.emit('erro', 'Sala cheia!');
      return;
    }

    const jogador = { id: socket.id, nome: nome || 'Jogador', pontos: 0 };
    sala.jogadores.push(jogador);
    socket.join(salaId);
    socket.data.salaId = salaId;
    socket.data.nome = jogador.nome;

    io.to(salaId).emit('sala_atualizada', {
      jogadores: sala.jogadores.map(j => ({ nome: j.nome, pontos: j.pontos })),
      fase: sala.fase,
    });

    if (sala.jogadores.length === 2) {
      sala.fase = 'jogando';
      const info = getRodadaInfo(sala);
      io.to(salaId).emit('iniciar_jogo', {
        jogadores: sala.jogadores.map(j => ({ nome: j.nome, pontos: j.pontos })),
        turno: sala.turno,
        prefixo: info.prefixo,
        rodadaAtual: sala.rodadaAtual,
        totalRodadas: sala.rodadas.length,
        letraAtual: info.letraAtual,
        totalLetras: info.totalLetras,
      });
    }
  });

  // ── Enviar palavra ─────────────────────────────────────────────────────────
  socket.on('enviar_palavra', ({ salaId, palavra }) => {
    const sala = salas[salaId];
    if (!sala || sala.fase !== 'jogando') return;

    const idxJogador = sala.jogadores.findIndex(j => j.id === socket.id);
    if (idxJogador !== sala.turno) {
      socket.emit('erro', 'Não é sua vez!');
      return;
    }

    // Timeout automático — tratar como erro de validade
    const isTimeout = palavra.trim() === '___TIMEOUT___';

    const info = getRodadaInfo(sala);
    const palavraUpper = normalizar(palavra);
    const prefixoNorm  = normalizar(info.prefixo);
    const secretaNorm  = normalizar(info.palavra);

    // ── 1. Verifica se existe no dicionário (ignora timeout)
    if (!isTimeout && !existeNoDicionario(palavraUpper)) {
      socket.emit('palavra_invalida', {
        motivo: 'não_dicionario',
        mensagem: `"${palavraUpper}" não está no dicionário.`,
      });
      return; // NÃO avança rodada; jogador deve tentar novamente
    }

    // ── 2. Verifica se começa com o prefixo
    const acertouPrefixo = isTimeout ? false : palavraUpper.startsWith(prefixoNorm);

    if (!acertouPrefixo) {
      // Errou: passa rodada
      io.to(salaId).emit('resultado_rodada', {
        acertou: false,
        jogadorIdx: idxJogador,
        palavraDigitada: isTimeout ? '(tempo esgotado)' : palavraUpper,
        palavraSecreta: info.palavra,
        prefixo: info.prefixo,
        pontos: sala.jogadores.map(j => j.pontos),
      });

      sala.rodadaAtual++;
      if (sala.rodadaAtual >= sala.rodadas.length) {
        encerrarJogo(salaId);
        return;
      }
      sala.turno = 0;
      const novaInfo = getRodadaInfo(sala);
      setTimeout(() => {
        io.to(salaId).emit('nova_rodada', {
          turno: sala.turno,
          prefixo: novaInfo.prefixo,
          rodadaAtual: sala.rodadaAtual,
          totalRodadas: sala.rodadas.length,
          letraAtual: novaInfo.letraAtual,
          totalLetras: novaInfo.totalLetras,
        });
      }, 2500);
    } else {
      // Acertou o prefixo
      const r = sala.rodadas[sala.rodadaAtual];

      // Verifica se digitou a palavra secreta completa (ou uma palavra que contém ela)
      const completou = palavraUpper === secretaNorm ||
        (palavraUpper.startsWith(secretaNorm) && palavraUpper.length >= secretaNorm.length);

      if (completou || r.letraAtual >= r.palavra.length - 1) {
        // ✅ Completou: +3 pontos
        sala.jogadores[idxJogador].pontos += 3;

        io.to(salaId).emit('resultado_rodada', {
          acertou: true,
          completou: true,
          jogadorIdx: idxJogador,
          palavraDigitada: palavraUpper,
          palavraSecreta: info.palavra,
          prefixo: info.palavra,
          pontos: sala.jogadores.map(j => j.pontos),
          pontosGanhos: 3,
        });

        sala.rodadaAtual++;
        if (sala.rodadaAtual >= sala.rodadas.length) {
          setTimeout(() => encerrarJogo(salaId), 2500);
          return;
        }
        sala.turno = 0;
        const novaInfo = getRodadaInfo(sala);
        setTimeout(() => {
          io.to(salaId).emit('nova_rodada', {
            turno: sala.turno,
            prefixo: novaInfo.prefixo,
            rodadaAtual: sala.rodadaAtual,
            totalRodadas: sala.rodadas.length,
            letraAtual: novaInfo.letraAtual,
            totalLetras: novaInfo.totalLetras,
          });
        }, 2500);
      } else {
        // Avança uma letra — troca de turno
        r.letraAtual++;
        sala.turno = sala.turno === 0 ? 1 : 0;
        const novaInfo = getRodadaInfo(sala);

        io.to(salaId).emit('resultado_rodada', {
          acertou: true,
          completou: false,
          jogadorIdx: idxJogador,
          palavraDigitada: palavraUpper,
          palavraSecreta: info.palavra,
          prefixo: novaInfo.prefixo,
          pontos: sala.jogadores.map(j => j.pontos),
          proximoTurno: sala.turno,
          letraAtual: novaInfo.letraAtual,
          totalLetras: novaInfo.totalLetras,
        });
      }
    }
  });

  // ── Reiniciar jogo ─────────────────────────────────────────────────────────
  socket.on('reiniciar_jogo', ({ salaId }) => {
    if (!salas[salaId]) return;
    const sala = salas[salaId];
    if (sala.jogadores.length < 2) return;

    const jogadoresAntes = sala.jogadores.map(j => ({ id: j.id, nome: j.nome }));
    criarSala(salaId);
    const novaSala = salas[salaId];

    jogadoresAntes.forEach((j, i) => {
      novaSala.jogadores.push({ id: j.id, nome: j.nome, pontos: 0 });
    });

    novaSala.fase = 'jogando';
    const info = getRodadaInfo(novaSala);
    io.to(salaId).emit('iniciar_jogo', {
      jogadores: novaSala.jogadores.map(j => ({ nome: j.nome, pontos: j.pontos })),
      turno: novaSala.turno,
      prefixo: info.prefixo,
      rodadaAtual: novaSala.rodadaAtual,
      totalRodadas: novaSala.rodadas.length,
      letraAtual: info.letraAtual,
      totalLetras: info.totalLetras,
    });
  });

  // ── Desconexão ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const salaId = socket.data.salaId;
    if (!salaId || !salas[salaId]) return;
    const sala = salas[salaId];
    sala.jogadores = sala.jogadores.filter(j => j.id !== socket.id);
    io.to(salaId).emit('jogador_saiu', { nome: socket.data.nome });
    if (sala.jogadores.length === 0) delete salas[salaId];
  });
});

// ─── Encerrar jogo ─────────────────────────────────────────────────────────────

function encerrarJogo(salaId) {
  const sala = salas[salaId];
  if (!sala) return;
  sala.fase = 'fim';
  const pontos = sala.jogadores.map(j => j.pontos);
  let vencedor = null;
  if (pontos[0] > pontos[1]) vencedor = sala.jogadores[0].nome;
  else if (pontos[1] > pontos[0]) vencedor = sala.jogadores[1].nome;
  io.to(salaId).emit('fim_jogo', {
    vencedor,
    pontos,
    nomes: sala.jogadores.map(j => j.nome),
  });
}

// ─── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ ok: true, palavras: PALAVRAS_SECRETAS.length }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT} | ${PALAVRAS_SECRETAS.length} palavras no dicionário`));