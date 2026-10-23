// 四個兵種的主武器、副武器與技能。
export const CLASSES = {
  assault: {
    id: 'assault',
    name: '突擊兵',
    role: '近距壓制與反載具',
    primary: 'mp18',
    secondary: 'p08',
    ability: 'atGrenade',
    grenade: 'grenade',
    grenades: 2,
    abilityCount: 1,
    icon: 'assault',
    color: '#c07a4a',
    stats: { 火力: 4, 射程: 2, 機動: 4, 支援: 1 }
  },
  medic: {
    id: 'medic',
    name: '醫療兵',
    role: '治療與復活隊友',
    primary: 'selbstlader',
    secondary: 'p08',
    ability: 'medkit',
    grenade: 'grenade',
    grenades: 2,
    abilityCount: 2,
    icon: 'medic',
    color: '#7ea36b',
    stats: { 火力: 3, 射程: 3, 機動: 3, 支援: 5 }
  },
  engineer: {
    id: 'engineer',
    name: '工程兵',
    role: '維修載具與佈雷',
    primary: 'bar',
    secondary: 'p08',
    ability: 'repair',
    grenade: 'mine',
    grenades: 2,
    abilityCount: 1,
    icon: 'engineer',
    color: '#c2a24f',
    stats: { 火力: 4, 射程: 3, 機動: 2, 支援: 5 }
  },
  scout: {
    id: 'scout',
    name: '狙擊兵',
    role: '遠距擊殺與偵察',
    primary: 'gewehr98',
    secondary: 'p08',
    ability: 'flare',
    grenade: 'grenade',
    grenades: 2,
    abilityCount: 2,
    icon: 'scout',
    color: '#9a9488',
    stats: { 火力: 5, 射程: 5, 機動: 2, 支援: 2 }
  }
};

export const CLASS_LIST = ['assault', 'medic', 'engineer', 'scout'];
