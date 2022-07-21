import {Injectable, Logger} from '@nestjs/common';
import * as child from 'child_process';
import { SerialPort } from 'serialport'
import * as fs from 'fs';
import {LivestreamGateway} from "../livestream/livestream.gateway";



@Injectable()
export class DevicesService {
    constructor(private liveStream: LivestreamGateway) {}
    dataString = '';
    dataswaitList = [];
    found = false;
    private msvREADY = false;

    get MSVONLINE() {
        return this.msvREADY
    }

    set MSVONLINE(value: boolean){
        this.msvREADY = value
    }

    crashed = false

    /**
     * HANDLES BYTES COMING IN
     * @param data bytes data that is converted hex string affter that
     */
    private handleData(data) {
        let valSPO2;
        let valPouls;
        let valGlycemie;
        let valTemp;
        let valTension;
        var mesures = [];
        this.dataString += data.toString('hex');

        //MSVHEALTHCHCECK
        // Checks if MSV is "on"
        if (this.dataString.includes('aa55ff')) {
            this.dataString = "";
            this.MSVONLINE = true
            console.log("MSVONLINE")
        }
        if (this.dataString.length >= 18) {




            //Search SPO2 and Pouls
            //Exemple: [aa 55 53 07 01 61 43 00 25 00 d9] corresponds à SpO2 = 97% et Pouls = 67 bpm
            if (this.dataString.substring(0, this.dataString.length - 6).includes('aa55530701')) {
                const n = this.dataString.search("aa55530701");
                // sometimes MSV doesnt answer so we check if they are sending spO2 data
                this.MSVONLINE = true
                console.log("MSVONLINE")
                valSPO2 = parseInt(this.dataString.substring(n + 10, n + 12), 16);
                valPouls = parseInt(this.dataString.substring(n + 12, n + 14), 16);
                mesures.push(
                  {
                      label: 'Pouls Périphériques',
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
                valTemp = Math.round(((30 + tmpRead / 100)) * 10) / 10;
                mesures.push(
                  {
                      label: 'Température',
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
                      label: 'Glycémie capillaire',
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

    /**
     * Emit to listener the last data from the vital signs monitor
     */
    private sendMesure() {
        setInterval(() => {
            const mesures = this.dataswaitList.pop();
            if (mesures && mesures.length > 0) {
                this.liveStream.server.emit('PC300', mesures);
            }
        }, 500)
    }

/**
 * resets value when the monitor is unplugged
 */
    private notifyError(){
        this.MSVONLINE = false
        this.found = false
        this.crashed = true
    }

    /**
     * Prints error
     * @param error serial port error
     */
    private onError(error){

        Logger.log('Error coming from MSV')
        Logger.log('Monitor might have been unplugged')
        Logger.log(error)
    }

    /**
     * Checks if MSV is still plugged in
     * @param port Serial port object
     */
    private sendAliveMsg(port){
        if (this.MSVONLINE) return
        this.MSVONLINE = false
        port.write('0xaa0x550xFF0x020x010xCA','hex', function(err) {
            if (err) {
                console.log(err)
            }
            console.log('writing')
        })
    }

/**
 * Get seiral port name
 * @returns The name of the port or an empty string if its not found
 */
    getPortName(): Promise<string>{
        return new Promise(resolve => {
            SerialPort.list().then(async (ports) => {
                if (ports.length == 0) {
                    resolve("")
                }
                for (const i in ports) {
                    if (ports[i].manufacturer === 'Prolific') {
                            resolve(ports[i].path)
                    }
                }
            });
        })
    }

    /**
     * Initialize port
     * @param path name of the port
     * @param baudRate the port to open the port with
     * @returns the Serial port object
     */
    openPort(path: string, baudRate: number){
        const port = new SerialPort({path: path, baudRate: baudRate, autoOpen: false });
        port.on('data', (data) => {
            this.handleData(data)
        });
        port.on('close',(data) => {
            this.onError(data)
            this.notifyError()
        } );
        this.sendMesure()
        return port
    }

    /**
     * send the helathcheck message
     * @param port port object
     * @returns
     */
    checkIfAlive(port){
        this.sendAliveMsg(port)
        return new Promise(resolve => setTimeout(resolve,2000, this.MSVONLINE))
    }

    /**
     * makes sure every 5 sec that MSV is still working
     * @param port port object
     * @returns
     */
    backgroundCheck(port) {
       return setInterval(() => {
            this.checkIfAlive(port)
        }, 5000)
    }

    /**
     * possible baud list, the program will iterate on them and stops once he finds data
     */
    baudList = [9600, 115200, 38400]

    /**
     * Recursive function thats tests for different baud rate and checks if the MSV is sending a message
     * @param port Serial port object
     * @param lastBaud Last baud rate used
     * @param j iterate through baudlist array
     * @returns true if its found a good port
     */
    async checkForFound(port,lastBaud, j){
        if(j === this.baudList.length ){
            return  this.checkForFound(port,this.baudList[j], 0)
        }
        if(this.baudList[j] != lastBaud && port.isOpen){
            await port.update({
                baudRate: this.baudList[j]
            })
        }
        this.checkIfAlive(port)
        /**
         * waits two seconds to allow the msv to send an answer
         */
        setTimeout(()=> {
            if(this.MSVONLINE){
                this.backgroundCheck(port)
                return true
            } else {
                return this.checkForFound(port,this.baudList[j], j+1)
            }
        }, 2000)

    }

    /**
     * Logic functions that runs the msv plug
     * @returns
     */
    async logic(): Promise<boolean>{
        const name = await this.getPortName()
        if(name === ""){
            return false
        }

        this.found = true
        const openedPort = this.openPort(name, 9600)
        openedPort.open((err) =>  {
            if (err) {
                Logger.log("Error opening oprt")
                Logger.log(err)
            }
            this.checkForFound(openedPort,9600, 0)
        })

    }

    /**
     * checks for the vital signs monitor every 5 seconds
     */
    startInterval(){
        setInterval(async () => {
            if(!this.found ){
               this.logic()
            }
            Logger.log(`Monitor status ${this.MSVONLINE}`)
            Logger.log(`Found ${this.found}`)

            this.liveStream.server.emit('PC300status', this.MSVONLINE);
        },5000);
    }

    async init() {
        this.startInterval()
    }


    /**
     * Reads carte vitale
     * @returns Returns carte vitale data
     */
    getCarteVitaleDatas() {
        return new Promise(async resolve => {
            child.execFile('LecteurVitale.exe', [`LecteurVitale: -ha -u user -ui false -cps true -debugnotes false -listall true -hr -n b`], { cwd: 'C:/Program Files/Promotal/LecteurVitale' }, (err, data) => {
                if (err) Logger.error(err)
                data = data.toString();
                data = data.replace('Buff : <?xml version="1.0" encoding="ISO-8859-1"?>','');
                const benefs = data.split('</T_AsnBeneficiaire><T_AsnBeneficiaire>');
                const search = ['date', 'adresse', 'prenomUsuel', 'nomUsuel', 'nir', 'codeGestion', 'codeRegime', 'caisse'];
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
