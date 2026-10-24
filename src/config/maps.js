// 三張地圖的完整設定。地圖生成器會依這些參數建立地形、佈局與天氣。
export const MAPS = [
  {
    id: 'ashen-valley',
    name: '灰燼谷',
    subtitle: '黎明薄霧 · 村落與戰壕',
    description: '暖陽穿過薄霧，教堂鐘塔俯瞰半毀村落。中央彈坑區是載具的墳場，南線戰壕則適合近距離肉搏。',
    size: 300,
    seed: 1916,
    weather: 'mist',
    tint: '#fff7ec',
    sky: {
      top: '#2b3a55',
      horizon: '#d9a36a',
      ground: '#4a3b2c',
      sun: '#ffd9a0',
      sunDir: [-0.65, 0.12, 0.35],
      cloud: 0.5,
      fog: '#c9b79f',
      fogDensity: 0.0095,
      light: '#ffd6a6',
      lightIntensity: 2.9,
      hemiSky: '#b7c9dc',
      hemiGround: '#6a5744',
      hemiIntensity: 1.0
    },
    terrain: {
      segments: 120,
      base: 0,
      amplitude: 2.2,
      noiseScale: 0.015,
      slopeZ: 0,
      craters: { count: 34, area: [0, 8, 85], radius: [3, 11], depth: [0.5, 2.1] },
      flatten: [
        { x: 0, z: -92, r: 62, h: 0.4, falloff: 26 },
        { x: 0, z: 142, r: 24, h: 0, falloff: 14 },
        { x: 0, z: -142, r: 24, h: 0, falloff: 14 }
      ],
      trenches: [
        {
          points: [[-135, 104], [-95, 99], [-60, 112], [-25, 101], [10, 111], [50, 99], [90, 110], [135, 104]],
          width: 6,
          depth: 2.2,
          openings: [[-95, 99, 3.2], [-25, 101, 3.2], [50, 99, 3.2], [90, 110, 3.2]]
        },
        { points: [[-45, 104], [-45, 72], [-35, 42]], width: 4.5, depth: 1.8, openings: [[-45, 80, 3], [-38, 56, 3]] }
      ],
      roads: [
        { points: [[0, -145], [0, -60], [0, 20], [0, 145]], width: 5 },
        { points: [[-80, -95], [0, -95], [80, -95]], width: 4 }
      ],
      river: null
    },
    palette: {
      mud: '#6b5843',
      mudDark: '#4a3d2e',
      grass: '#7a7a4f',
      rock: '#8b8476',
      road: '#8d7a60',
      crater: '#3b3126'
    },
    flags: [
      { id: 'A', name: '中央彈坑', pos: [0, 12], radius: 17 },
      { id: 'B', name: '教堂廣場', pos: [-8, -92], radius: 17 },
      { id: 'C', name: '南線戰壕', pos: [20, 98], radius: 17 }
    ],
    spawns: [
      { team: 'A', pos: [0, 142], name: '協約國營地' },
      { team: 'B', pos: [0, -142], name: '同盟國營地' }
    ],
    vehicles: [
      { type: 'tank', team: 'A', pos: [-18, 145], rot: 0 },
      { type: 'tank', team: 'B', pos: [18, -145], rot: Math.PI },
      { type: 'jeep', team: 'A', pos: [18, 145], rot: 0 },
      { type: 'jeep', team: 'B', pos: [-18, -145], rot: Math.PI }
    ],
    features: {
      village: { center: [0, -92], radius: 72, buildings: 10, church: true, churchPos: [-10, -108] },
      craterField: { center: [0, 12], radius: 80 },
      trenches: true,
      forest: { count: 34 },
      artillery: [[-38, 18], [44, -18]],
      smoke: [[-18, 8], [26, -14], [-10, -78], [58, 62]],
      fires: [[-18, 8], [58, 62]],
      puddles: true,
      birds: true
    }
  },
  {
    id: 'dusk-ridge',
    name: '黃昏嶺',
    subtitle: '黃昏暖陽 · 台地與堡壘',
    description: '夕陽把山脊染成金紅。山頂石堡控制全圖視野，鐵路車站與葡萄園農舍則是裝甲部隊的必爭之地。',
    size: 280,
    seed: 1917,
    weather: 'clear',
    tint: '#fff4e8',
    sky: {
      top: '#1c2437',
      horizon: '#e39a55',
      ground: '#3a2d24',
      sun: '#ffbe72',
      sunDir: [0.62, 0.14, 0.32],
      cloud: 0.42,
      fog: '#d6a273',
      fogDensity: 0.007,
      light: '#ffc17d',
      lightIntensity: 3.4,
      hemiSky: '#b6a8cf',
      hemiGround: '#6a5744',
      hemiIntensity: 1.05
    },
    terrain: {
      segments: 110,
      base: 0,
      amplitude: 4.5,
      noiseScale: 0.012,
      slopeZ: -0.08,
      craters: { count: 14, area: [-20, 30, 70], radius: [3, 9], depth: [0.4, 1.6] },
      flatten: [
        { x: 0, z: -90, r: 48, h: 15, falloff: 30 },
        { x: -70, z: 40, r: 38, h: 2, falloff: 20 },
        { x: 80, z: 60, r: 32, h: -2, falloff: 18 },
        { x: 0, z: 125, r: 22, h: -7, falloff: 14 },
        { x: 0, z: -128, r: 22, h: 12, falloff: 14 }
      ],
      trenches: [
        { points: [[-34, -58], [-22, -50], [-8, -46], [8, -50], [22, -58]], width: 4, depth: 1.6, openings: [[-8, -47, 3], [8, -50, 3]] }
      ],
      roads: [
        { points: [[0, 130], [-18, 95], [10, 60], [-12, 25], [0, -10], [0, -55], [0, -90]], width: 4.5 },
        { points: [[-70, 40], [-20, 20], [30, 30], [80, 60]], width: 3.5 }
      ],
      river: null
    },
    palette: {
      mud: '#7d6348',
      mudDark: '#554334',
      grass: '#8a8552',
      rock: '#a39684',
      road: '#a68966',
      crater: '#443526'
    },
    flags: [
      { id: 'A', name: '鐵路車站', pos: [-58, 36], radius: 17 },
      { id: 'B', name: '山頂堡壘', pos: [0, -90], radius: 18 },
      { id: 'C', name: '葡萄園農舍', pos: [80, 60], radius: 17 }
    ],
    spawns: [
      { team: 'A', pos: [0, 125], name: '協約國營地' },
      { team: 'B', pos: [0, -128], name: '同盟國營地' }
    ],
    vehicles: [
      { type: 'tank', team: 'A', pos: [0, 118], rot: 0 },
      { type: 'tank', team: 'B', pos: [0, -120], rot: Math.PI },
      { type: 'jeep', team: 'A', pos: [-18, 118], rot: 0 },
      { type: 'jeep', team: 'B', pos: [18, -120], rot: Math.PI }
    ],
    features: {
      fort: { center: [0, -90], radius: 50, wallHeight: 5.5 },
      station: { center: [-70, 40] },
      vineyard: { center: [80, 60], rows: 7 },
      railway: { points: [[-140, 30], [-70, 40], [0, 50], [120, 60]] },
      terraces: true,
      forest: { count: 26 },
      artillery: [[-52, -52], [64, 24]],
      smoke: [[-72, 36], [8, -84], [72, 58]],
      fires: [[-72, 36]],
      puddles: false,
      birds: true
    }
  },
  {
    id: 'rainy-ford',
    name: '陰雨渡口',
    subtitle: '陰雨藍灰 · 河流與磨坊',
    description: '冷雨讓泥濘與河水都成了敵人。斷橋與淺灘是唯一的裝甲通道，磨坊與補給倉庫隔河對峙。',
    size: 300,
    seed: 1918,
    weather: 'rain',
    tint: '#f7fbff',
    sky: {
      top: '#28323d',
      horizon: '#78858e',
      ground: '#363b3e',
      sun: '#c6d0d8',
      sunDir: [-0.4, 0.35, 0.2],
      cloud: 0.85,
      fog: '#b7c3cb',
      fogDensity: 0.011,
      light: '#e6eef3',
      lightIntensity: 2.4,
      hemiSky: '#adbfcc',
      hemiGround: '#62686b',
      hemiIntensity: 1.3
    },
    terrain: {
      segments: 120,
      base: 0,
      amplitude: 1.8,
      noiseScale: 0.018,
      slopeZ: 0.015,
      craters: { count: 22, area: [-60, 35, 85], radius: [3, 10], depth: [0.5, 1.8] },
      flatten: [
        { x: -90, z: -20, r: 36, h: 1.5, falloff: 18 },
        { x: 35, z: -10, r: 26, h: 0.6, falloff: 14 },
        { x: -50, z: 80, r: 24, h: 0.4, falloff: 12 },
        { x: -135, z: 70, r: 22, h: 0.2, falloff: 12 },
        { x: 135, z: -70, r: 22, h: 0.2, falloff: 12 }
      ],
      trenches: [
        {
          points: [[-100, 75], [-78, 84], [-58, 82], [-40, 72], [-24, 68]],
          width: 5,
          depth: 2,
          openings: [[-78, 84, 3], [-40, 72, 3]]
        }
      ],
      roads: [
        { points: [[-140, 70], [-80, 66], [-30, 62], [0, 60], [40, 30], [80, 0], [120, -40], [135, -70]], width: 5 },
        { points: [[-90, -20], [-40, -10], [0, 0], [35, -10]], width: 4 }
      ],
      river: {
        points: [[0, -150], [0, -100], [0, -50], [0, 0], [0, 50], [0, 100], [0, 150]],
        width: 28,
        bed: -4.6,
        waterLevel: -1.2,
        fords: [
          { z: 60, width: 16, bed: -1.7 },
          { z: -80, width: 10, bed: -1.5 }
        ]
      }
    },
    palette: {
      mud: '#6a695c',
      mudDark: '#4a4a43',
      grass: '#7a8162',
      rock: '#969c9b',
      road: '#888174',
      crater: '#3b3d36'
    },
    flags: [
      { id: 'A', name: '補給倉庫', pos: [-90, -10], radius: 17 },
      { id: 'B', name: '河岸磨坊', pos: [30, 2], radius: 17 },
      { id: 'C', name: '半淹戰壕', pos: [-50, 66], radius: 17 }
    ],
    spawns: [
      { team: 'A', pos: [-135, 70], name: '協約國營地' },
      { team: 'B', pos: [135, -70], name: '同盟國營地' }
    ],
    vehicles: [
      { type: 'tank', team: 'A', pos: [-125, 78], rot: Math.PI / 2 },
      { type: 'tank', team: 'B', pos: [125, -78], rot: -Math.PI / 2 },
      { type: 'jeep', team: 'A', pos: [-118, 88], rot: Math.PI / 2 },
      { type: 'jeep', team: 'B', pos: [118, -88], rot: -Math.PI / 2 }
    ],
    features: {
      depot: { center: [-90, -20] },
      mill: { center: [35, -10] },
      bridge: { z: 0 },
      footbridge: { z: -80 },
      ford: { z: 60 },
      barges: [[8, 24], [-12, 92]],
      floodedTrench: true,
      forest: { count: 18 },
      artillery: [[-60, -60], [60, 50]],
      smoke: [[-92, -24], [40, -14], [-52, 78]],
      fires: [[-92, -24]],
      puddles: true,
      birds: false
    }
  }
];

export function getMap(id) {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}
