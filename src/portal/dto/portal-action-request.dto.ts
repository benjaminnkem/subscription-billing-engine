import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsOptional } from 'class-validator';

export class PortalActionRequestDto {
  @ApiProperty({ example: 'SWITCH_PLAN' })
  @IsString()
  action: string;

  @ApiProperty({ example: { planId: 'p1a2b3d4-...' }, required: false })
  @IsObject()
  @IsOptional()
  data?: any;
}
