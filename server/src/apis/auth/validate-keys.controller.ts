import { Controller, Post, Body } from '@nestjs/common';
import { ValidateKeysService } from './validate-keys.service';
import { ValidateKeysDto } from './dto/validate-keys.dto';

@Controller('validate-keys')
export class ValidateKeysController {
    constructor(private readonly validateKeysService: ValidateKeysService) {}

    @Post()
    async validateKeys(@Body() validateKeysDto: ValidateKeysDto) {
        return this.validateKeysService.validateAndImportKeys(validateKeysDto);
    }
}

