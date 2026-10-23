// 全域遊戲規則與難度參數。調整這裡就能改變節奏。
export const GAME = {
  fixedStep: 1 / 60,
  gravity: -20,
  playerTeam: 'A',
  tickets: 300,
  roundTime: 15 * 60,
  respawnDelay: 5,
  bleedoutTime: 20,
  reviveTime: 2,
  captureRadius: 17,
  captureRate: 0.115,
  captureRatePerSoldier: 0.035,
  botCountPerTeam: 8,
  botRespawnDelay: 6,
  vehicleRespawnDelay: 30,
  maxProjectiles: 80,
  maxEffects: 220,
  teams: {
    A: { id: 'A', name: '協約國', short: '協約', color: '#6f92b3', dark: '#3d5368' },
    B: { id: 'B', name: '同盟國', short: '同盟', color: '#b06f5a', dark: '#6b3f34' }
  },
  botDifficulty: {
    reactionMin: 0.22,
    reactionMax: 0.5,
    aimError: 0.035,
    aimErrorMoving: 0.07,
    maxRange: 85,
    fov: Math.PI * 0.72,
    burstMin: 0.3,
    burstMax: 0.65,
    burstPauseMin: 0.35,
    burstPauseMax: 0.8
  },
  namesA: ['Dubois', 'Marchand', 'Lefèvre', 'Moreau', 'Garnier', 'Rousseau', 'Chevalier', 'Fontaine', 'Girard', 'Lambert', 'Perrin', 'Faure'],
  namesB: ['Müller', 'Schmidt', 'Weber', 'Fischer', 'Wagner', 'Becker', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf', 'Neumann'],
  classNames: {
    assault: '突擊兵',
    medic: '醫療兵',
    engineer: '工程兵',
    scout: '狙擊兵'
  }
};

export const STORAGE_KEY = 'ironmud1916_settings';
