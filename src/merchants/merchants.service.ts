import {
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchant } from './entities/merchant.entity';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { MonnifyService } from '../payments/monnify.service';

@Injectable()
export class MerchantsService {
  constructor(
    @InjectRepository(Merchant) private merchantRepo: Repository<Merchant>,
    @Inject(forwardRef(() => MonnifyService))
    private monnifyService: MonnifyService,
  ) {}

  async findOne(id: string): Promise<Merchant> {
    const merchant = await this.merchantRepo.findOne({ where: { id } });
    if (!merchant) {
      throw new NotFoundException(`Merchant not found`);
    }
    return merchant;
  }

  async update(id: string, dto: UpdateMerchantDto): Promise<Merchant> {
    const merchant = await this.findOne(id);

    if (dto.businessName !== undefined)
      merchant.businessName = dto.businessName;
    if (dto.phone !== undefined) merchant.phone = dto.phone;
    if (dto.branding !== undefined) merchant.branding = dto.branding;
    if (dto.webhookUrl !== undefined) merchant.webhookUrl = dto.webhookUrl;

    if (dto.bankCode !== undefined) merchant.bankCode = dto.bankCode;
    if (dto.bankName !== undefined) merchant.bankName = dto.bankName;
    if (dto.bankAccountNumber !== undefined)
      merchant.bankAccountNumber = dto.bankAccountNumber;
    if (dto.bankAccountName !== undefined)
      merchant.bankAccountName = dto.bankAccountName;
    if (dto.customerPortalSettings !== undefined)
      merchant.customerPortalSettings = dto.customerPortalSettings;

    return this.merchantRepo.save(merchant);
  }

  async getBanks() {
    return this.monnifyService.fetchBanks();
  }

  async lookupAccount(accountNumber: string, bankCode: string) {
    return this.monnifyService.lookupAccount(accountNumber, bankCode);
  }
}
