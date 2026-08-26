export type Instructor = {
  id: string; name: string; rating: number; reviews: number; area: string; price: number;
  specialties: string[]; licenses: string[]; vehicle: string; verified: boolean;
  nextSlot: string; lessons: number; intro: string;
};

export const instructors: Instructor[] = [
  { id:'kim-minsu', name:'김민수', rating:4.96, reviews:238, area:'강남 · 서초 · 송파', price:90000, specialties:['장롱면허','주차','도심주행'], licenses:['1종 보통','2종 보통'], vehicle:'아반떼 CN7 · 보조브레이크', verified:true, nextSlot:'오늘 14:00', lessons:1248, intro:'처음 다시 운전대를 잡는 분이 긴장하지 않도록 단계별로 진행합니다.' },
  { id:'park-jiyoon', name:'박지윤', rating:4.93, reviews:181, area:'마포 · 용산 · 서대문', price:85000, specialties:['초보운전','야간운전','고속도로'], licenses:['1종 보통','2종 보통'], vehicle:'K3 · 보조브레이크', verified:true, nextSlot:'오늘 17:30', lessons:936, intro:'실제 생활 동선을 중심으로 반복 연습하는 실전형 수업을 진행합니다.' },
  { id:'lee-dohyun', name:'이도현', rating:4.89, reviews:94, area:'성남 · 분당 · 판교', price:110000, specialties:['1종 보통','대형','도로주행'], licenses:['1종 대형','1종 보통'], vehicle:'스타리아 · 교육장치', verified:true, nextSlot:'내일 09:00', lessons:702, intro:'차량 크기와 시야 적응부터 차근차근 익히는 교육을 선호합니다.' }
];

export const lessonTypes = [
  ['장롱면허','다시 운전대를 잡는 실전 연수','🪪'],
  ['면허 준비','도로주행과 차량 조작 연습','🚦'],
  ['주차 집중','평행·후진·지하주차 연습','🅿️'],
  ['고속도로','합류·차선변경·장거리 주행','🛣️'],
  ['야간 운전','야간 시야와 도심 주행','🌙'],
  ['대형·특수','차종별 전문 교관 탐색','🚚']
];
