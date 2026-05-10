import { Module, Global } from '@nestjs/common';
import { MonoService } from './mono.service';

@Global()
@Module({
  providers: [MonoService],
  exports: [MonoService],
})
export class MonoModule {}
