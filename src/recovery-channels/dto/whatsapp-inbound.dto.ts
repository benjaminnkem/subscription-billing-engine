import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { RecoveryAction } from '../recovery-action.enum';

export class WhatsappInboundDto {
  @ApiProperty({
    description:
      'Subscriber phone number, E.164 or Twilio "whatsapp:+234..." format',
    example: '+2348012345678',
  })
  @IsString()
  from: string;

  @ApiProperty({
    enum: [RecoveryAction.RETRY, RecoveryAction.PAUSE, RecoveryAction.CANCEL],
    description:
      'Which inline action the subscriber tapped. WhatsApp does not offer STATUS.',
  })
  @IsIn([RecoveryAction.RETRY, RecoveryAction.PAUSE, RecoveryAction.CANCEL])
  action: RecoveryAction.RETRY | RecoveryAction.PAUSE | RecoveryAction.CANCEL;

  @ApiPropertyOptional({
    description: "Twilio's message SID, if this came from a real account",
  })
  @IsOptional()
  @IsString()
  messageSid?: string;
}
