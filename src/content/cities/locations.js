// Geographic locations of Xian cities and landmarks
export const locations = {
  "daming-palace": {
    name: { zh: "大明宫", en: "Daming Palace" },
    description: { zh: "唐代宫殿声景档案", en: "Tang Dynasty Soundscape Archive" },
    coordinates: [34.2983, 108.8181],
    hotspots: [
      {
        id: "bell",
        label: { zh: "晨钟悠悠", en: "Morning Bell" },
        coordinates: [34.2983, 108.8181],
        color: "accent-strong"
      },
      {
        id: "corridor",
        label: { zh: "回廊风韵", en: "Corridor Harmonics" },
        coordinates: [34.2990, 108.8175],
        color: "accent"
      },
      {
        id: "courtyard",
        label: { zh: "广场回响", en: "Courtyard Resonance" },
        coordinates: [34.2975, 108.8190],
        color: "accent"
      }
    ]
  },
  "bell-tower": {
    name: { zh: "钟楼", en: "Bell Tower" },
    description: { zh: "城市中心的时间标记", en: "Urban Time Marker" },
    coordinates: [34.3416, 108.9398],
    hotspots: [
      {
        id: "bell-main",
        label: { zh: "钟声回荡", en: "Bell Resonance" },
        coordinates: [34.3416, 108.9398],
        color: "accent-strong"
      },
      {
        id: "drum",
        label: { zh: "鼓声激越", en: "Drum Vitality" },
        coordinates: [34.3416, 108.9398],
        color: "accent"
      }
    ]
  },
  "yongning-gate": {
    name: { zh: "永宁门", en: "Yongning Gate" },
    description: { zh: "古城外的历史守卫", en: "Guardian of Ancient History" },
    coordinates: [34.2573, 108.9371],
    hotspots: [
      {
        id: "gate-sound",
        label: { zh: "城门的呼吸", en: "Gate Breath" },
        coordinates: [34.2573, 108.9371],
        color: "accent-strong"
      },
      {
        id: "fortification",
        label: { zh: "城墙低音", en: "Wall Resonance" },
        coordinates: [34.2575, 108.9373],
        color: "accent"
      }
    ]
  }
};

export const mapCenter = [34.3412, 108.9398]; // Xi'an city center
export const mapZoom = 13;
