export const AssetKeys = {
  hermes: 'hermes-runner',
  hermesRun: 'hermes-run-cycle',
  lobster: 'openclaw-lobster',
  obstacleLow: 'myth-tech-barricade',
  obstacleHigh: 'myth-tech-zapbar',
  powerupChomp: 'powerup-chomp',
  powerupSandals: 'powerup-sandals',
  powerupGoblet: 'powerup-goblet',
  powerupBolt: 'powerup-bolt',
  powerupMagnet: 'powerup-magnet',
  roadway: 'myth-tech-roadway',
  introOlympusSignal: 'intro-olympus-signal',
  introOpenclawSurge: 'intro-openclaw-surge',
  introHermesLaunch: 'intro-hermes-launch',
  introGodspeedRun: 'intro-godspeed-run',
  introTitleBackdrop: 'intro-title-backdrop',
  introNarration: 'intro-narration'
} as const;

export const AssetManifest = {
  hermes: {
    key: AssetKeys.hermes,
    url: new URL('../../assets/characters/hermes-runner-game.png', import.meta.url).href
  },
  hermesRun: {
    key: AssetKeys.hermesRun,
    url: new URL('../../assets/characters/hermes-run-strip.png', import.meta.url).href,
    frameWidth: 512,
    frameHeight: 512,
    frames: 4
  },
  lobster: {
    key: AssetKeys.lobster,
    url: new URL('../../assets/enemies/openclaw-lobster-game.png', import.meta.url).href
  },
  obstacles: {
    low: {
      key: AssetKeys.obstacleLow,
      url: new URL('../../assets/obstacles/myth-tech-barricade.png', import.meta.url).href
    },
    high: {
      key: AssetKeys.obstacleHigh,
      url: new URL('../../assets/obstacles/myth-tech-zapbar.png', import.meta.url).href
    }
  },
  powerups: {
    chomp: {
      key: AssetKeys.powerupChomp,
      url: new URL('../../assets/powerups/chomp-relic.png', import.meta.url).href
    },
    sandals: {
      key: AssetKeys.powerupSandals,
      url: new URL('../../assets/powerups/sandals-relic.png', import.meta.url).href
    },
    goblet: {
      key: AssetKeys.powerupGoblet,
      url: new URL('../../assets/powerups/goblet-relic.png', import.meta.url).href
    },
    bolt: {
      key: AssetKeys.powerupBolt,
      url: new URL('../../assets/powerups/bolt-relic.png', import.meta.url).href
    },
    magnet: {
      key: AssetKeys.powerupMagnet,
      url: new URL('../../assets/powerups/magnet-relic.png', import.meta.url).href
    }
  },
  roadway: {
    key: AssetKeys.roadway,
    url: new URL('../../assets/environment/myth-tech-roadway-game.jpg', import.meta.url).href
  },
  cutscene: {
    olympusSignal: {
      key: AssetKeys.introOlympusSignal,
      url: new URL('../../assets/cutscene/intro-olympus-signal.jpg', import.meta.url).href
    },
    openclawSurge: {
      key: AssetKeys.introOpenclawSurge,
      url: new URL('../../assets/cutscene/intro-openclaw-surge.jpg', import.meta.url).href
    },
    hermesLaunch: {
      key: AssetKeys.introHermesLaunch,
      url: new URL('../../assets/cutscene/intro-hermes-launch.jpg', import.meta.url).href
    },
    godspeedRun: {
      key: AssetKeys.introGodspeedRun,
      url: new URL('../../assets/cutscene/intro-godspeed-run.jpg', import.meta.url).href
    },
    titleBackdrop: {
      key: AssetKeys.introTitleBackdrop,
      url: new URL('../../assets/cutscene/intro-title-backdrop.jpg', import.meta.url).href
    }
  },
  audio: {
    introNarration: {
      key: AssetKeys.introNarration,
      url: new URL('../../assets/cutscene/intro-narration.mp3', import.meta.url).href
    }
  }
} as const;
