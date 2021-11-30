import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  
 @Get('ecg')
  getEcg() {
    require('child_process').execFile('PhotoFiltre.exe', null, { cwd: 'C:\\Program Files (x86)\\PhotoFiltre' }, (err, data) => {
      if (err) return err;
      else return 'ok';
    });
  }
}
