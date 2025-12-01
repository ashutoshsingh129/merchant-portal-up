import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('charges')
export class Charge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  @Index()
  userId: number;

  @Column({ name: 'stripe_id', unique: true })
  @Index()
  stripeId: string;

  @Column({ name: 'stripe_data', type: 'jsonb' })
  stripeData: any;

  @Column({ nullable: true })
  amount: number;

  @Column({ nullable: true, length: 10 })
  @Index()
  currency: string;

  @Column({ nullable: true, length: 50 })
  @Index()
  status: string;

  @Column({ name: 'customer_id', nullable: true })
  @Index()
  customerId: string;

  @Column({ name: 'customer_email', nullable: true })
  @Index()
  customerEmail: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'payment_intent_id', nullable: true })
  @Index()
  paymentIntentId: string;

  @Column({ name: 'payment_method_type', nullable: true, length: 50 })
  @Index()
  paymentMethodType: string;

  @Column({ name: 'amount_refunded', default: 0 })
  amountRefunded: number;

  @Column({ default: false })
  @Index()
  refunded: boolean;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'stripe_created_at', nullable: true })
  @Index()
  stripeCreatedAt: Date;
}
