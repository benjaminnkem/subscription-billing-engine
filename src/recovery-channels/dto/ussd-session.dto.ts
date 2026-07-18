import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UssdSessionDto {
  @ApiProperty({ description: "The aggregator's session identifier" })
  @IsString()
  sessionId: string;

  @ApiProperty({
    description: 'Subscriber phone number, E.164 format',
    example: '+2348012345678',
  })
  @IsString()
  phoneNumber: string;

  @ApiProperty({
    description:
      'Full input history since the session started, "*"-joined (e.g. "1", "2", "1*2")',
    example: '1',
  })
  @IsString()
  text: string;
}
