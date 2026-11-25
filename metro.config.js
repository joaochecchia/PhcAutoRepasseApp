// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Por padrão o Metro abre um worker por núcleo (15 nesta máquina de 16 núcleos e 7 GB),
// e o primeiro bundle esgota a memória e trava o sistema. METRO_MAX_WORKERS sobrescreve.
config.maxWorkers = Number(process.env.METRO_MAX_WORKERS) || 2;

module.exports = config;
