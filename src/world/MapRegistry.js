import { AshenValley } from './maps/AshenValley.js';
import { DuskRidge } from './maps/DuskRidge.js';
import { RainyFord } from './maps/RainyFord.js';

// 地圖 id 對應的生成類別。
export const MAP_CLASSES = {
  'ashen-valley': AshenValley,
  'dusk-ridge': DuskRidge,
  'rainy-ford': RainyFord
};

export function createMap(game, id) {
  const C = MAP_CLASSES[id] || AshenValley;
  return new C(game);
}
