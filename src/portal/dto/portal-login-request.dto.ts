import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsUUID } from 'class-validator';

export class PortalLoginRequestDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '1b0f0637-5ef9-49b9-94db-f7bfb1c49d78' })
  @IsUUID()
  merchantId: string;

  @ApiPropertyOptional({
    enum: ['test', 'live'],
    default: 'live',
    description: 'Which portal config set to apply for this session',
  })
  @IsOptional()
  @IsIn(['test', 'live'])
  mode?: 'test' | 'live';
}
