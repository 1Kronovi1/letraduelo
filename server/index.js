const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Lista de palavras secretas com pelo menos 4 letras
const PALAVRAS = [
  'ABACATE','ABÓBORA','ACORDO','ACESSO','AGENTE','ALEGRIA','ALFACE','ALUNO',
  'AMARGO','AMIZADE','AMOR','ANDAR','ANEL','ANIMAL','ANOS','ANTES',
  'APARELHO','APRENDER','AQUÁRIO','ÁRABE','ÁRVORE','ASAS','ASSIM','ATENÇÃO',
  'AVENIDA','AVIÃO','AZUL',
  'BAIRRO','BALEIA','BANANA','BARCO','BATALHA','BEBIDA','BELEZA','BIBLIOTECA',
  'BICICLETA','BLUSA','BOCA','BOLSA','BOLO','BORBOLETA','BRASIL','BRAVO',
  'CABELO','CAFÉ','CAIXA','CALOR','CAMELO','CAMINHO','CAMPO','CANETA',
  'CANÇÃO','CAPITÃO','CARRO','CASA','CAVALO','CÉREBRO','CHAPÉU','CHAVE',
  'CHOCOLATE','CIDADE','CINEMA','CIRCO','COBRA','COELHO','COGUMELO','COMBATE',
  'COMIDA','COMPUTADOR','CORAGEM','CORAÇÃO','CORRIDA','CRIANÇA',
  'DADO','DANÇA','DENTE','DESAFIO','DESTINO','DINHEIRO','DIPLOMA','DISCURSO',
  'DISTÂNCIA','DIVERSÃO','DORMIR','DRAGÃO',
  'ESCOLA','ESCRITÓRIO','ESPELHO','ESTRADA','ESTRELA','EXEMPLO',
  'FÁBRICA','FAMÍLIA','FARDA','FAZENDA','FELIZ','FESTA','FÍGADO','FLOR',
  'FLORESTA','FORÇA','FORMIGA','FOTOGRAFIA','FRANGO','FRUTA','FUTEBOL',
  'GALINHA','GARAGEM','GATO','GELADO','GIRASSOL','GLOBO','GOVERNO','GRANDE',
  'GUERRA','GUITARRA',
  'HELICÓPTERO','HISTÓRIA','HORIZONTE','HOSPITAL',
  'ILHA','IMAGEM','IMPOSTO','INDÚSTRIA','INSETO','INTELIGÊNCIA',
  'JANELA','JARDIM','JOGADOR','JORNAL','JOVEM',
  'LAGARTO','LAGO','LARANJA','LEBRE','LEITE','LEOPARDO','LETRA','LÍNGUA',
  'LIVRO','LOBO','LOJA','LONGE','LUA','LUGAR','LUVA',
  'MAÇÃ','MADEIRA','MADRUGADA','MÃE','MÁGICA','MALETA','MAMÃO','MANGA',
  'MANGUEIRA','MÁQUINA','MAR','MÁRMORE','MEDO','MELANCIA','MEMÓRIA',
  'MENINO','MESA','METAL','MILHO','MISTÉRIO','MONTANHA','MOTOR','MUNDO','MÚSICO',
  'NAÇÃO','NATAL','NATUREZA','NAVE','NEGÓCIO','NINHO','NOITE','NOME','NÚMERO',
  'OBJETO','ÓCULOS','OLHAR','ONÇA','ÔNIBUS','OURO','OUTRA',
  'PADRE','PAÍS','PALCO','PALMEIRA','PÃO','PAPEL','PAREDE','PARQUE',
  'PASSAGEM','PASSARINHO','PATO','PEDRA','PERFUME','PESSOA','PLANETA',
  'PLANTA','POLVO','PONTE','PORTA','PODER','PROFESSOR','PRAIA',
  'QUEIJO','QUÍMICA','QUINTO',
  'RÁDIO','RAPOSA','RAZÃO','RELÓGIO','REINO','REMÉDIO','RIQUEZA','RISCO',
  'ROBÔ','ROCHA','RODA','ROMANCE','ROSA','ROSTO',
  'SABÃO','SAÍDA','SALA','SAÚDE','SEGREDO','SEMANA','SEMENTE','SINAL',
  'SISTEMA','SOL','SONHO','SORTE','SUCO',
  'TÁBUA','TAMBOR','TARDE','TEATRO','TEMPO','TERRA','TIGRE','TOMATE',
  'TRABALHO','TREM','TRIBO','TROFÉU','TUCANO',
  'UNIVERSO','URSO','UVAS',
  'VACA','VALOR','VENTO','VERDADE','VIAGEM','VIDA','VIZINHO','VOCÊ','VOZ',
  'XADREZ','XÍCARA',
  'ZEBRA','ZONA'
];

const ALFABETO = 'ABCDEFGHIJLMNOPQRSTUVXZ'.split('');

function embaralhar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function gerarRodadas() {
  // Seleciona 10 palavras aleatórias
  const palavrasSel = embaralhar(PALAVRAS).slice(0, 10);
  return palavrasSel.map(palavra => ({ palavra, letraAtual: 0 }));
}

// Salas de jogo: { [salaId]: GameState }
const salas = {};

function criarSala(salaId) {
  const rodadas = gerarRodadas();
  salas[salaId] = {
    jogadores: [],      // [{ id, nome, pontos }]
    rodadaAtual: 0,
    rodadas,
    turno: 0,           // índice do jogador (0 ou 1)
    fase: 'aguardando', // aguardando | jogando | fim
    ultimaResposta: null,
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

io.on('connection', (socket) => {
  console.log('Conectado:', socket.id);

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

  socket.on('enviar_palavra', ({ salaId, palavra }) => {
    const sala = salas[salaId];
    if (!sala || sala.fase !== 'jogando') return;

    const idxJogador = sala.jogadores.findIndex(j => j.id === socket.id);
    if (idxJogador !== sala.turno) {
      socket.emit('erro', 'Não é sua vez!');
      return;
    }

    const info = getRodadaInfo(sala);
    const palavraUpper = palavra.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const prefixoNorm = info.prefixo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const palavraSecretaNorm = info.palavra.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const acertou = palavraUpper.startsWith(prefixoNorm);

    if (!acertou) {
      // Errou: próxima rodada
      io.to(salaId).emit('resultado_rodada', {
        acertou: false,
        jogadorIdx: idxJogador,
        palavraDigitada: palavra.toUpperCase(),
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
      // Acertou: revela mais uma letra ou palavra completa
      const r = sala.rodadas[sala.rodadaAtual];

      // Verifica se digitou a palavra secreta exata
      const completou = palavraUpper === palavraSecretaNorm || palavraUpper.startsWith(palavraSecretaNorm) && palavraUpper.length >= palavraSecretaNorm.length;

      if (completou || r.letraAtual >= r.palavra.length - 1) {
        // Ponto para quem completou
        sala.jogadores[idxJogador].pontos++;
        io.to(salaId).emit('resultado_rodada', {
          acertou: true,
          completou: true,
          jogadorIdx: idxJogador,
          palavraDigitada: palavra.toUpperCase(),
          palavraSecreta: info.palavra,
          prefixo: info.palavra,
          pontos: sala.jogadores.map(j => j.pontos),
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
        // Avança uma letra
        r.letraAtual++;
        sala.turno = sala.turno === 0 ? 1 : 0;
        const novaInfo = getRodadaInfo(sala);

        io.to(salaId).emit('resultado_rodada', {
          acertou: true,
          completou: false,
          jogadorIdx: idxJogador,
          palavraDigitada: palavra.toUpperCase(),
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

  socket.on('reiniciar_jogo', ({ salaId }) => {
    if (!salas[salaId]) return;
    const sala = salas[salaId];
    if (sala.jogadores.length < 2) return;
    const nomes = sala.jogadores.map(j => j.nome);
    criarSala(salaId);
    const novaSala = salas[salaId];
    // Readiciona jogadores com novos pontos zerados
    nomes.forEach((nome, i) => {
      novaSala.jogadores.push({ id: sala.jogadores[i]?.id || '', nome, pontos: 0 });
    });
    // Copia socket ids
    if (sala.jogadores[0]) novaSala.jogadores[0].id = sala.jogadores[0].id;
    if (sala.jogadores[1]) novaSala.jogadores[1].id = sala.jogadores[1].id;

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

  socket.on('disconnect', () => {
    const salaId = socket.data.salaId;
    if (!salaId || !salas[salaId]) return;
    const sala = salas[salaId];
    sala.jogadores = sala.jogadores.filter(j => j.id !== socket.id);
    io.to(salaId).emit('jogador_saiu', { nome: socket.data.nome });
    if (sala.jogadores.length === 0) delete salas[salaId];
  });
});

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

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
