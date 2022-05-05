/* Composant permettant la gestion de l'appel entre PDS et médecin*/


import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import {Server, Socket} from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway(4000, {allowEIO3: true, cors: {
    origin: ["https://connect.promotal.com","https://connect.dev.promotal.com", "http://localhost:4200", "https://new.connect.dev.promotal.com", "https://new.connect.promotal.com"],
    credentials: true,
    methods: ["GET", "POST"]
  }})
export class LivestreamGateway implements OnGatewayConnection {
    constructor() {}

    onlineStaffs = [];
    @WebSocketServer() server: Server;

    async handleConnection(@ConnectedSocket() socket: Socket) {
      Logger.log('qql sest connete');
    }

// Fonction transmettant l'information de connexion à l'instance d'appel
  @SubscribeMessage('online')
  async setOnline(@ConnectedSocket() socket: Socket) {
        try {
            socket.join('staff');
            const x = await this.server.in('staff').allSockets();
            x.forEach(x => Logger.log(x))
        } catch (e) {
            return e;
        }
  }
}
