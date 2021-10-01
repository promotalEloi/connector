import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DevicesModule } from './devices/devices.module';
import { DevicesService } from './devices/devices.service';
import { LivestreamModule } from './livestream/livestream.module';

@Module({
  imports: [DevicesModule, LivestreamModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnModuleInit {

  constructor(private devicesService: DevicesService) {}

  onModuleInit() {
    this.devicesService.init();
  }
}
