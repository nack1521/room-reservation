export class CreateReservationDto {
  roomId: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  note?: string;
}
