import { IsString, IsNotEmpty } from 'class-validator';

export class ValidateKeysDto {
    @IsString()
    @IsNotEmpty()
    publicKey: string;

    @IsString()
    @IsNotEmpty()
    secretKey: string;
}


