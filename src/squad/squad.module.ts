import { Module, Global } from '@nestjs/common';
import { SquadService } from './squad.service';

@Global()
@Module({
  providers: [SquadService],
  exports: [SquadService],
})
export class SquadModule {}
