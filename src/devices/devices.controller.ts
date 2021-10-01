import {Body, Controller, Get, Logger, Post} from '@nestjs/common';
import {DevicesService} from './devices.service';
@Controller('devices')
export class DevicesController {

    constructor(public deviceService: DevicesService){}


    @Get('cartevitale')
    async getCarteVitale(@Body() datas: any) {
        return await this.deviceService.getCarteVitaleDatas();
    }


/*    @Post('ECG')
    async getECG(@Body() datas: any) {
        return this.deviceService.getECG(datas);
    }*/
}



