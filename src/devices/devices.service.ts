import {ForbiddenException, Injectable, Logger} from '@nestjs/common';
import * as child from 'child_process';
import * as sp from 'serialport';
import * as fs from 'fs';
import {LivestreamGateway} from "../livestream/livestream.gateway";
@Injectable()
export class DevicesService {
    constructor(private liveStream: LivestreamGateway) {}
    dataString = '';
    dataswaitList = [];
    private handleData(data) {
        let valSPO2;
        let valPouls;
        let valGlycemie;
        let valTemp;
        let valTension;
        var mesures = [];
        this.dataString += data.toString('hex');
        if (this.dataString.length >= 18) {
            //Search SPO2 and Pouls
            //Exemple: [aa 55 53 07 01 61 43 00 25 00 d9] corresponds à SpO2 = 97% et Pouls = 67 bpm
            if (this.dataString.substring(0, this.dataString.length - 6).includes('aa55530701')) {
                const n = this.dataString.search("aa55530701");
                valSPO2 = parseInt(this.dataString.substring(n + 10, n + 12), 16);
                valPouls = parseInt(this.dataString.substring(n + 12, n + 14), 16);
                mesures.push(
                  {
                      label: 'Pulsations',
                      value: valPouls.toString(),
                      unit: 'bpm'
                  });
                mesures.push(
                  {
                      label: 'Saturation O2',
                      value: valSPO2.toString(),
                      unit: '%'
                  });
                this.dataString = "";
            }
            //Search Tension
            //Exemple: [aa 55 43 07 01 00 8d 00 60 00 0e] corresponds à une tension de 141/90
            if (this.dataString.substring(0, this.dataString.length - 6).includes('aa5543070100')) {
                const n = this.dataString.search("aa5543070100");
                var tmpHigh = parseInt(this.dataString.substring(n + 12, n + 14), 16);
                var tmpLo = parseInt(this.dataString.substring(n + 16, n + 18), 16);
                valTension = `${(tmpHigh /10).toString()}/${(tmpLo / 10).toString()}`;
                mesures.push(
                  {
                      label: 'Tension',
                      value: valTension.toString(),
                      unit: 'mmHg'
                  });
                this.dataString = "";
            }
            //Search Temperature
            //Exemple: [aa 55 72 05 01 40 02 61 53] corresponds à une température de 36,09 Celsius, (30 + 609 / 100)
            if (this.dataString.substring(0, this.dataString.length - 6).includes('aa5572050140')) {
                const n = this.dataString.search("aa5572050140");
                var tmpRead = parseInt(this.dataString.substring(n + 12, n + 16), 16);
                valTemp = Math.round((30 + tmpRead / 100) * 10) / 10;
                mesures.push(
                  {
                      label: 'Temperature',
                      value: valTemp.toString(),
                      unit: '°C'
                  });
                this.dataString = "";
            }
            //Search Gycemie
            //Exemple: [aa 55 73 05 01 00 00 38 83] corresponds à un niveau de glucose de 3,8 mmol/L
            if (this.dataString.substring(0, this.dataString.length - 6).includes('aa5573050100')) {
                const n = this.dataString.search("aa5573050100");
                var tmpRead = parseInt(this.dataString.substring(n + 14, n + 16), 10);
                valGlycemie = tmpRead / 10;
                mesures.push(
                  {
                      label: 'Glycemie capillaire',
                      value: valGlycemie.toString(),
                      unit: 'mg/dL'
                  })
                this.dataString = "";
            }
            //clean dataString buffer
            if (this.dataString.length > 200) {
                this.dataString = this.dataString.substring(this.dataString.length - 20);
            }
            if (mesures.length > 0) {
                mesures.forEach(mesure => {
                    Logger.log(mesure)
                });
                this.dataswaitList.push(mesures)
            }
        }
    }
    private sendMesure() {
        setInterval(() => {
            const mesures = this.dataswaitList.pop();
            if (mesures && mesures.length > 0) {
                Logger.log(JSON.stringify(mesures))
                this.liveStream.server.to('staff').emit('PC300', mesures);
            }
        }, 500)
    }
    async init() {
        let found = false;
        setInterval(async () => {
            if(!found){
                sp.list().then((ports, err) => {
                    if (ports.length > 0) {
                        for (const i in ports) {
                            if (ports[i].manufacturer === 'Prolific') {
                                found = true;
                                const ttt = new sp(ports[i].path, {baudRate: 9600 });
                                ttt.on('data', (data) => {
                                    this.handleData(data);
                                });
                                ttt.on('close', (err) => {
                                    Logger.log("disconnected");
                                    Logger.log(err);
                                    found= false
                                });
                                this.sendMesure()
                            }
                        }
                        if (!found) {
                            Logger.log('Le moniteur de signe Vitaux n\'as pas pu être trouvé');
                        }
                    } else {
                        found = false;
                        Logger.log('Aucun appareil n\'est connecté');
                    }
                });
            }
            this.liveStream.server.to('staff').emit('PC300status', found);
        }, 3000);
    }


    getCarteVitaleDatas() {
        return new Promise(async resolve => {
            child.execFile('LecteurVitale.exe', [`LecteurVitale: -ha -u user -ui false -cps true -debugnotes false -listall true -hr -n b`], { cwd: 'C:/Program Files/Promotal/LecteurVitale' }, (err, data) => {
                data = data.toString();
                data = data.replace('Buff : <?xml version="1.0" encoding="ISO-8859-1"?>','');
                const benefs = data.split('</T_AsnBeneficiaire><T_AsnBeneficiaire>');
                const search = ['date', 'adresse', 'prenomUsuel', 'nomUsuel', 'caisse', 'nir', 'codeRegime', 'caisse', 'centreCarte'];
                const listBenefs = [];
                benefs.forEach(benef => {
                    const infos = {};
                    search.forEach(x => {
                        infos[x] = benef.substring((benef.lastIndexOf('<' + x + '>') + (x.length + 2)), benef.lastIndexOf('</' + x + '>'))
                    });
                    listBenefs.push(infos);
                });
                listBenefs[0].prenomUsuel === '' ? resolve([]) :  resolve(listBenefs);
            });
        });
    }


    /*    async getECG(datas: any) {
            try {
                const pdfFolder = '/ddd/';
                fs.readdir(pdfFolder, (error, files) => {
                    if (error) throw error;
                    files.forEach(filename => {
                        if (filename.endsWith('pdf')) {
                            fs.readFile(pdfFolder + '/' + filename, { encoding: "base64" }, async (err, data) => {
                                if (err) throw err
                                const base64response = await fetch(`data:application/pdf;base64,${data}`);
                                const blob = await base64response.blob();
                                this.consultationService.uploadFileb64(new Blob([blob]), 'pdf', filename, this.consultationService.consultation.value._id).then(() => {
                                    fs.unlink(pdfFolder + '/' + filename, (err) => {
                                        if (err) {
                                            Logger.log(err)
                                        }
                                        Logger.log(`PDF des ECG ajouté avec succès`)
                                    })
                                })
                            })
                        }
                    })
                })
            } catch (e) {
                Logger.log(e);
                return new ForbiddenException(e);
            }
        }*/
}
