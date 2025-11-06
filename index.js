// === Importazioni ===
const express = require('express');
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  Routes,
  REST,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const fs = require('fs');

// === Config ===
const token = process.env.DISCORD_TOKEN;
const clientId = '1435446237183611055';
const guildId = '1435443913811820616';
const roleManager = '1435455223773794465';
const channelTimbro = '1435776987913257102';
const channelControllo = '1435934502236061746';
const FILE_FATTURE = './fatture.json';
const FILE_TIMBRI = './timbri.json';

// === Avvio webserver per Replit ===
const app = express();
app.get('/', (_, res) => res.send('✅ Bot attivo e funzionante!'));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🌐 Server web su porta ${port}`));

// === Client Discord ===
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// === Caricamento dati ===
let fatture = {};
let timbri = {};

if (fs.existsSync(FILE_FATTURE)) {
  try { fatture = JSON.parse(fs.readFileSync(FILE_FATTURE, 'utf8')); } catch { fatture = {}; }
}
if (fs.existsSync(FILE_TIMBRI)) {
  try { timbri = JSON.parse(fs.readFileSync(FILE_TIMBRI, 'utf8')); } catch { timbri = {}; }
}

function salvaFatture() {
  fs.writeFileSync(FILE_FATTURE, JSON.stringify(fatture, null, 2));
}
function salvaTimbri() {
  fs.writeFileSync(FILE_TIMBRI, JSON.stringify(timbri, null, 2));
}

// === Comandi ===
const commands = [
  // --- FATTURE ---
  new SlashCommandBuilder()
    .setName('fattura')
    .setDescription('Crea una nuova fattura')
    .addIntegerOption(o => o.setName('importo').setDescription('Importo in $').setRequired(true))
    .addStringOption(o => o.setName('motivo').setDescription('Motivo della fattura').setRequired(true)),

  new SlashCommandBuilder()
    .setName('fatturato')
    .setDescription('Mostra quanto ha fatturato un utente')
    .addUserOption(o => o.setName('utente').setDescription('Utente da controllare').setRequired(true)),

  new SlashCommandBuilder()
    .setName('topfatturanti')
    .setDescription('Mostra la classifica dei top fatturanti'),

  new SlashCommandBuilder()
    .setName('nuovasettimana')
    .setDescription('Azzera tutte le fatture e ricomincia da 0'),

  // --- TIMBRI ---
  new SlashCommandBuilder()
    .setName('controllotimbri')
    .setDescription('Mostra chi ha il cartellino aperto e il tempo attivo'),

  new SlashCommandBuilder()
    .setName('resettatempo')
    .setDescription('Resetta il tempo di un utente specifico')
    .addUserOption(o => o.setName('utente').setDescription('Utente da resettare').setRequired(true))
].map(c => c.toJSON());

// === Registrazione comandi ===
const rest = new REST({ version: '10' }).setToken(token);
(async () => {
  try {
    console.log('🌀 Registrazione comandi...');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('✅ Comandi registrati correttamente!');
  } catch (err) {
    console.error('❌ Errore nella registrazione comandi:', err);
  }
})();

// === Avvio bot ===
client.once('ready', async () => {
  console.log(`✅ Bot avviato come ${client.user.tag}`);

  const canaleTimbro = await client.channels.fetch(channelTimbro);
  const canaleControllo = await client.channels.fetch(channelControllo);

  // --- Recupera o crea l'embed per timbrare ---
  let messaggi = await canaleTimbro.messages.fetch({ limit: 10 });
  let messaggioTimbro = messaggi.find(m => m.author.id === client.user.id && m.embeds[0]?.title?.includes('Gestione Cartellini'));

  if (!messaggioTimbro) {
    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle('🕒 Gestione Cartellini di Servizio')
      .setDescription('Premi il pulsante per timbrare l\'entrata o l\'uscita dal servizio.')
      .setFooter({ text: 'Sistema automatico di timbratura' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('timbra_entrata').setLabel('🟢 Timbra Cartellino').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('timbra_uscita').setLabel('🔴 Esci dal Servizio').setStyle(ButtonStyle.Danger)
    );

    messaggioTimbro = await canaleTimbro.send({ embeds: [embed], components: [row] });
  }

  // --- Embed controllo automatico ---
  let controlloMsg;
  const old = await canaleControllo.messages.fetch({ limit: 10 });
  controlloMsg = old.find(m => m.author.id === client.user.id && m.embeds[0]?.title?.includes('Cartellini Attivi'));

  if (!controlloMsg) {
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📊 Cartellini Attivi')
      .setDescription('Nessun cartellino attivo al momento.')
      .setFooter({ text: 'Aggiornamento automatico ogni 2 minuti' });
    controlloMsg = await canaleControllo.send({ embeds: [embed] });
  }

  // Aggiornamento ogni 2 minuti
  setInterval(async () => {
    const entries = Object.entries(timbri).filter(([_, v]) => v.start);
    if (entries.length === 0) {
      await controlloMsg.edit({
        embeds: [new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle('📊 Cartellini Attivi')
          .setDescription('Nessun cartellino attivo al momento.')
          .setFooter({ text: 'Aggiornamento automatico ogni 2 minuti' })
        ]
      });
    } else {
      let desc = '';
      for (const [id, data] of entries) {
        const ms = Date.now() - data.start;
        const min = Math.floor(ms / 60000);
        const ore = Math.floor(min / 60);
        const minuti = min % 60;
        desc += `👤 <@${id}> — ⏱️ ${ore}h ${minuti}m\n`;
      }
      await controlloMsg.edit({
        embeds: [new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle('📊 Cartellini Attivi')
          .setDescription(desc)
          .setFooter({ text: 'Aggiornamento automatico ogni 2 minuti' })
        ]
      });
    }
  }, 120000);
});

// === Gestione interazioni ===
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    const id = interaction.customId;
    const user = interaction.user;

    if (id === 'timbra_entrata') {
      if (timbri[user.id]?.start) {
        return interaction.reply({ content: '⚠️ Hai già un cartellino aperto!', ephemeral: true });
      }
      timbri[user.id] = { start: Date.now(), total: timbri[user.id]?.total || 0 };
      salvaTimbri();
      return interaction.reply({ content: '🟢 Cartellino aperto! Ricordati di chiuderlo quando esci dal servizio.', ephemeral: true });
    }

    if (id === 'timbra_uscita') {
      if (!timbri[user.id]?.start) {
        return interaction.reply({ content: '⚠️ Non hai un cartellino aperto.', ephemeral: true });
      }
      const durata = Date.now() - timbri[user.id].start;
      timbri[user.id].total += durata;
      timbri[user.id].start = null;
      salvaTimbri();

      const min = Math.floor(durata / 60000);
      const ore = Math.floor(min / 60);
      const minuti = min % 60;
      return interaction.reply({ content: `🔴 Cartellino chiuso! Hai lavorato ${ore}h ${minuti}m.`, ephemeral: true });
    }
  }

  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction.commandName;

  // === FATTURE ===
  if (cmd === 'fattura') {
    const importo = interaction.options.getInteger('importo');
    const motivo = interaction.options.getString('motivo');
    const user = interaction.user;

    if (!fatture[user.id]) fatture[user.id] = 0;
    fatture[user.id] += importo;
    salvaFatture();

    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle('📜 Nuova Fattura Registrata')
      .addFields(
        { name: '👤 Fatturante', value: `<@${user.id}>`, inline: true },
        { name: '💰 Importo', value: `${importo}$`, inline: true },
        { name: '📋 Motivo', value: motivo }
      )
      .setFooter({ text: `Creata da ${user.tag}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  if (['fatturato', 'topfatturanti', 'nuovasettimana'].includes(cmd)) {
    if (!interaction.member.roles.cache.has(roleManager))
      return interaction.reply({ content: '🚫 Non hai il permesso per questo comando.', ephemeral: true });
  }

  if (cmd === 'fatturato') {
    const utente = interaction.options.getUser('utente');
    const totale = fatture[utente.id] || 0;
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📊 Report Fatturato')
      .addFields(
        { name: '👤 Utente', value: `<@${utente.id}>`, inline: true },
        { name: '💵 Totale Fatturato', value: `${totale}$`, inline: true }
      )
      .setFooter({ text: `Richiesto da ${interaction.user.tag}` })
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  if (cmd === 'topfatturanti') {
    if (Object.keys(fatture).length === 0)
      return interaction.reply('📉 Nessuna fattura registrata.');
    const classifica = Object.entries(fatture)
      .sort((a, b) => b[1] - a[1])
      .map(([id, imp], i) => `${i + 1}. <@${id}> — 💰 **${imp}$**`)
      .join('\n');
    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('🏆 Top Fatturanti')
      .setDescription(classifica)
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  if (cmd === 'nuovasettimana') {
    fatture = {};
    salvaFatture();
    return interaction.reply('🔄 Tutte le fatture sono state azzerate.');
  }

  // === TIMBRI ===
  if (cmd === 'controllotimbri') {
    if (!interaction.member.roles.cache.has(roleManager))
      return interaction.reply({ content: '🚫 Non hai il permesso.', ephemeral: true });

    const entries = Object.entries(timbri).filter(([_, v]) => v.start);
    if (entries.length === 0)
      return interaction.reply('📉 Nessun cartellino attivo.');

    let desc = '';
    for (const [id, data] of entries) {
      const ms = Date.now() - data.start;
      const min = Math.floor(ms / 60000);
      const ore = Math.floor(min / 60);
      const minuti = min % 60;
      desc += `👤 <@${id}> — ⏱️ ${ore}h ${minuti}m\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🕒 Controllo Cartellini')
      .setDescription(desc)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  if (cmd === 'resettatempo') {
    if (!interaction.member.roles.cache.has(roleManager))
      return interaction.reply({ content: '🚫 Non hai il permesso.', ephemeral: true });

    const utente = interaction.options.getUser('utente');
    if (!timbri[utente.id]) return interaction.reply('❌ Nessun dato trovato per questo utente.');

    timbri[utente.id] = { start: null, total: 0 };
    salvaTimbri();
    return interaction.reply(`✅ Tempo di <@${utente.id}> resettato correttamente.`);
  }
});

client.login(token);
