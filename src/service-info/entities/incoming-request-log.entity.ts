import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('incoming_request_logs')
export class IncomingRequestLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'varchar', length: 10 })
  method: string;

  @Column({ type: 'varchar', length: 500 })
  path: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'jsonb', default: {} })
  headers: Record<string, string>;

  @Column({ type: 'varchar', length: 500, nullable: true })
  signature?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  monnifyTimestamp?: string;

  @Column({ type: 'jsonb', nullable: true })
  body?: Record<string, unknown>;

  @Column({ type: 'int', nullable: true })
  statusCode?: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}