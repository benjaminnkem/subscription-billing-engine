import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsUUID } from 'class-validator';

export class PortalLoginRequestDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '1b0f0637-5ef9-49b9-94db-f7bfb1c49d78' })
  @IsUUID()
  merchantId: string;
}
