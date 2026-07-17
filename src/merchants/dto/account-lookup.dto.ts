import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class AccountLookupDto {
  @ApiProperty()
  @IsString()
  @Length(10, 10, { message: 'Account number must be exactly 10 digits' })
  accountNumber: string;

  @ApiProperty()
  @IsString()
  bankCode: string;
}
