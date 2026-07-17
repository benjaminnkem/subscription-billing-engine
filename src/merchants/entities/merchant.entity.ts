import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiKey } from '../../api-keys/entities/api-key.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('merchants')
export class Merchant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  businessName: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'jsonb', nullable: true })
  branding?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  customerPortalSettings?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 500, nullable: true })
  webhookUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  webhookSecret?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  bankCode?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  bankAccountNumber?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bankAccountName?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => User, (user) => user.merchant)
  users: User[];

  @OneToMany(() => ApiKey, (apiKey) => apiKey.merchant)
  apiKeys: ApiKey[];
}
