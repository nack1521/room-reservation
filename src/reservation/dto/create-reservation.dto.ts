export class ReservationAddOnDto {
  addOnId: string;
  qty: number;
}

export class CreateReservationDto {
  roomId: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  note?: string;
  addOns?: ReservationAddOnDto[];
}
