// Vietnamese display names for Vietjet's main domestic destinations.
// International airports fall back to the English `airport.name` the API already returns
// (e.g. "Jakarta", "Seoul") — those don't need translation for CSKH purposes.
export const VN_AIRPORT_NAMES: Record<string, string> = {
  HAN: 'Hà Nội',
  SGN: 'TP.HCM',
  DAD: 'Đà Nẵng',
  CXR: 'Nha Trang',
  HPH: 'Hải Phòng',
  VII: 'Vinh',
  VCA: 'Cần Thơ',
  DLI: 'Đà Lạt',
  PQC: 'Phú Quốc',
  UIH: 'Quy Nhơn',
  VDO: 'Vân Đồn',
  THD: 'Thanh Hóa',
  HUI: 'Huế',
  PXU: 'Pleiku',
  VCL: 'Chu Lai',
  BMV: 'Buôn Ma Thuột',
  VCS: 'Côn Đảo',
  TBB: 'Tuy Hòa',
  DIN: 'Điện Biên',
};

// English/no-diacritic display names for the "en" output style.
export const EN_AIRPORT_NAMES: Record<string, string> = {
  HAN: 'Hanoi',
  SGN: 'Ho Chi Minh City',
  DAD: 'Da Nang',
  CXR: 'Nha Trang',
  HPH: 'Hai Phong',
  VII: 'Vinh',
  VCA: 'Can Tho',
  DLI: 'Da Lat',
  PQC: 'Phu Quoc',
  UIH: 'Quy Nhon',
  VDO: 'Van Don',
  THD: 'Thanh Hoa',
  HUI: 'Hue',
  PXU: 'Pleiku',
  VCL: 'Chu Lai',
  BMV: 'Buon Ma Thuot',
  VCS: 'Con Dao',
  TBB: 'Tuy Hoa',
  DIN: 'Dien Bien',
};

export function airportNameEn(code: string, fallback: string): string {
  return EN_AIRPORT_NAMES[code] ?? fallback;
}

export function airportNameVi(code: string, fallback: string): string {
  return VN_AIRPORT_NAMES[code] ?? fallback;
}
