import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { RevenueRadarController } from './revenue-radar.controller';
import { RevenueRadarService } from './revenue-radar.service';

@Module({
  imports: [AiModule],
  controllers: [RevenueRadarController],
  providers: [RevenueRadarService],
})
export class RevenueRadarModule {}
