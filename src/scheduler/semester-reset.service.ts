import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class SemesterResetService {
  private readonly logger = new Logger(SemesterResetService.name);

  // run at 00:00 on Jan 1 and Jun 1 (server timezone)
  @Cron('0 0 0 1 1 *')
  async resetJan() { await this.reset(); }

  @Cron('0 0 0 1 6 *')
  async resetJun() { await this.reset(); }

  private async reset() {
    this.logger.log('Semester reset: implement archiving / clearing class fixtures or recurring reservations here');
    // recommended: mark old semester on Class/Reservation, remove one-off reservations if needed
  }
}