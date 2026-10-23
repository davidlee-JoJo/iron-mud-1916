// 全域遊戲規則與難度參數。調整這裡就能改變節奏。
export const GAME = {
  fixedStep: 1 / 60,
  gravity: -20,
  playerTeam: 'A',
  tickets: 400,
  roundTime: 15 * 60,
  respawnDelay: 5,
  bleedoutTime: 20,
  reviveTime: 2,
  captureRadius: 17,
  captureRate: 0.08,
  captureRatePerSoldier: 0.02,
  botCountPerTeam: 16,
  playerTeamBotCount: 15,
  botRespawnDelay: 6,
  vehicleRespawnDelay: 30,
  maxProjectiles: 80,
  maxEffects: 220,
  teams: {
    A: { id: 'A', name: '協約國', short: '協約', color: '#6f92b3', dark: '#3d5368' },
    B: { id: 'B', name: '同盟國', short: '同盟', color: '#b06f5a', dark: '#6b3f34' }
  },
  botDifficulty: {
    reactionMin: 0.15,
    reactionMax: 0.35,
    aimError: 0.04,
    aimErrorMoving: 0.08,
    maxRange: 90,
    fov: Math.PI * 0.72,
    burstMin: 0.35,
    burstMax: 0.7,
    burstPauseMin: 0.25,
    burstPauseMax: 0.55
  },
  namesA: ['Dubois', 'Marchand', 'Lefèvre', 'Moreau', 'Garnier', 'Rousseau', 'Chevalier', 'Fontaine', 'Girard', 'Lambert', 'Perrin', 'Faure', 'Bernard', 'Laurent', 'Renard', 'Colin', 'Roux', 'Vidal', 'Brun', 'Noël'],
  namesB: ['Müller', 'Schmidt', 'Weber', 'Fischer', 'Wagner', 'Becker', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf', 'Neumann', 'Schulz', 'Krüger', 'Lange', 'Werner', 'Krause', 'Meier', 'Lehmann', 'Schwarz'],
  classNames: {
    assault: '突擊兵',
    medic: '醫療兵',
    engineer: '工程兵',
    scout: '狙擊兵'
  }
};

export const STORAGE_KEY = 'ironmud1916_settings';
