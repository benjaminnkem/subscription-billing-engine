import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('event_store')
export class EventStore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  merchantId: string;

  @Column({ type: 'varchar', length: 100 })
  eventType: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  aggregateType?: string;

  @Column({ type: 'uuid', nullable: true })
  aggregateId?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  correlationId?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category?: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata?: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  processed: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
