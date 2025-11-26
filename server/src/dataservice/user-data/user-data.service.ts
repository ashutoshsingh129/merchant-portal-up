import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { pool } from '../../utilities/dbconfig';
import { User } from '../../datastore/models/user.model';

@Injectable()
export class UserDataService {
    async createUser(user: User): Promise<User> {
        const hash = await bcrypt.hash(user.passwordHash || '', 10);

        const query = `
            INSERT INTO users (stripe_id, username, email, name, password_hash, raw_data)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (stripe_id)
            DO UPDATE SET
                username = EXCLUDED.username,
                email = EXCLUDED.email,
                name = EXCLUDED.name,
                password_hash = EXCLUDED.password_hash,
                raw_data = EXCLUDED.raw_data,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id, stripe_id as "stripeId", username, email, name, password_hash as "passwordHash", raw_data as "rawData", created_at as "createdAt", updated_at as "updatedAt";
        `;

        const values = [
            user.stripeId || null,
            user.username,
            user.email || null,
            user.name || null,
            hash,
            user.rawData ? JSON.stringify(user.rawData) : null,
        ];

        const result = await pool.query(query, values);
        const row = result.rows[0];
        if (row.rawData && typeof row.rawData === 'string') {
            row.rawData = JSON.parse(row.rawData);
        }
        return row;
    }

    async findUserByUsername(username: string): Promise<User | null> {
        const query = `
            SELECT id, stripe_id as "stripeId", username, email, name, password_hash as "passwordHash", 
                   raw_data as "rawData", created_at as "createdAt", updated_at as "updatedAt" 
            FROM users 
            WHERE username=$1
        `;
        const result = await pool.query(query, [username]);
        if (result.rows.length === 0) {
            return null;
        }
        const row = result.rows[0];
        if (row.rawData && typeof row.rawData === 'string') {
            row.rawData = JSON.parse(row.rawData);
        }
        return row;
    }

    async validatePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    async findUserById(id: number): Promise<User | null> {
        const query = `
            SELECT id, stripe_id as "stripeId", username, email, name, password_hash as "passwordHash", 
                   raw_data as "rawData", created_at as "createdAt", updated_at as "updatedAt" 
            FROM users 
            WHERE id=$1
        `;
        const result = await pool.query(query, [id]);
        if (result.rows.length === 0) {
            return null;
        }
        const row = result.rows[0];
        if (row.rawData && typeof row.rawData === 'string') {
            row.rawData = JSON.parse(row.rawData);
        }
        return row;
    }
}

