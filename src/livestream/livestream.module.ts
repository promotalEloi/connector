import {Module} from '@nestjs/common';
import {LivestreamGateway} from './livestream.gateway';

@Module({
    imports: [],
    exports: [LivestreamGateway],
    controllers: [],
    providers: [LivestreamGateway],
})
@Module({})
export class LivestreamModule {}
