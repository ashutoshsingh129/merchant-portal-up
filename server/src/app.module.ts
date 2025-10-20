import { Module } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApisModule } from './apis/apis.module';

dotenv.config();

@Module({
  imports: [ApisModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
