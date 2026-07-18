import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../../auth/strategies/jwt.strategy';
import { TimelineEvent } from './dto/timeline-event.dto';

@WebSocketGateway({
  namespace: '/mission-control',
  cors: { origin: true, credentials: true },
})
export class MissionControlGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MissionControlGateway.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      this.logger.warn(`Client ${client.id} rejected: missing token`);
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });

      if (!payload.merchantId) {
        client.disconnect();
        return;
      }

      client.data.merchantId = payload.merchantId;
      await client.join(this.merchantRoom(payload.merchantId));
      this.logger.log(
        `Client ${client.id} connected for merchant ${payload.merchantId}`,
      );
    } catch {
      this.logger.warn(`Client ${client.id} rejected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  broadcastEvent(merchantId: string, event: TimelineEvent): void {
    this.server.to(this.merchantRoom(merchantId)).emit('event', event);
  }

  private merchantRoom(merchantId: string): string {
    return `merchant:${merchantId}`;
  }
}
