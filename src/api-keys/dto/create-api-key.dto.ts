import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiKeyEnvironment } from '../../shared/enums';

export class CreateApiKeyDto {
  @ApiProperty({ enum: ApiKeyEnvironment })
  @IsEnum(ApiKeyEnvironment)
  environment: ApiKeyEnvironment;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}
