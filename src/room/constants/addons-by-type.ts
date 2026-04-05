export type AddOnItem = {
  id: string;
  label: string;
  unit: string;
  max: number;
};

export const ADDONS_BY_TYPE: Record<string, AddOnItem[]> = {
  Lecture: [
    { id: 'whiteboard', label: 'กระดานไวท์บอร์ดเสริม', unit: 'แผ่น', max: 2 },
    { id: 'chair', label: 'เก้าอี้เสริม', unit: 'ตัว', max: 30 },
    { id: 'table', label: 'โต๊ะเสริม', unit: 'ตัว', max: 10 },
    { id: 'mic', label: 'ไมค์ลอย', unit: 'ตัว', max: 4 },
  ],
  'Computer Lab': [
    { id: 'pc-extra', label: 'เครื่องคอมพ์เสริม', unit: 'เครื่อง', max: 10 },
    { id: 'it-support', label: 'เจ้าหน้าที่ IT On-site', unit: 'คน', max: 2 },
    { id: 'headset', label: 'หูฟังไมค์', unit: 'ชุด', max: 20 },
  ],
  Seminar: [
    { id: 'coffee', label: 'Coffee Break', unit: 'ชุด', max: 100 },
    { id: 'projector', label: 'โปรเจคเตอร์เสริม', unit: 'เครื่อง', max: 1 },
    { id: 'mc-stand', label: 'ไมค์ตั้งโต๊ะ', unit: 'ตัว', max: 4 },
  ],
  Workshop: [
    { id: 'workbench', label: 'โต๊ะทำงานกลุ่มเพิ่ม', unit: 'ชุด', max: 6 },
    { id: 'toolkit', label: 'ชุดอุปกรณ์ Workshop', unit: 'ชุด', max: 20 },
    { id: 'safety', label: 'อุปกรณ์ความปลอดภัย', unit: 'ชุด', max: 30 },
  ],
  'Electronics Lab': [
    { id: 'solder', label: 'หัวแร้งบัดกรี', unit: 'ชุด', max: 10 },
    { id: 'psu', label: 'Power Supply', unit: 'เครื่อง', max: 6 },
    { id: 'scope', label: 'Oscilloscope', unit: 'เครื่อง', max: 4 },
  ],
};

export const getAddOnsByType = (type?: string): AddOnItem[] => {
  if (!type) {
    return [];
  }

  return ADDONS_BY_TYPE[type] ? [...ADDONS_BY_TYPE[type]] : [];
};
