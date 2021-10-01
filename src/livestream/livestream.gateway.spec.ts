import { Test, TestingModule } from '@nestjs/testing';
import { LivestreamGateway } from './livestream.gateway';

describe('LivestreamGateway', () => {
  let gateway: LivestreamGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LivestreamGateway],
    }).compile();

    gateway = module.get<LivestreamGateway>(LivestreamGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
