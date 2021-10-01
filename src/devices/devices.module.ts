import { Module } from '@nestjs/common';
import {DevicesService} from './devices.service';
import {DevicesController} from './devices.controller';
import {LivestreamModule} from "../livestream/livestream.module";

@Module({
    imports: [LivestreamModule],
    providers: [DevicesService],
    controllers: [DevicesController],
    exports: [DevicesService],
})


export class DevicesModule {}
