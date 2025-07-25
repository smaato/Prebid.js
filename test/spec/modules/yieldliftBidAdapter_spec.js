import {expect} from 'chai';
import {spec} from 'modules/yieldliftBidAdapter.js';

const REQUEST = {
  'bidderCode': 'yieldlift',
  'auctionId': 'auctionId-56a2-4f71-9098-720a68f2f708',
  'bidderRequestId': 'requestId',
  'bidRequest': [{
    'bidder': 'yieldlift',
    'params': {
      'unitId': 123456,
    },
    'placementCode': 'div-gpt-dummy-placement-code',
    'mediaTypes': {'banner': {'sizes': [[300, 250]]}},
    'bidId': 'bidId1',
    'bidderRequestId': 'bidderRequestId',
    'auctionId': 'auctionId-56a2-4f71-9098-720a68f2f708'
  },
  {
    'bidder': 'yieldlift',
    'params': {
      'unitId': 123456,
    },
    'placementCode': 'div-gpt-dummy-placement-code',
    'mediaTypes': {'banner': {'sizes': [[300, 250]]}},
    'bidId': 'bidId2',
    'bidderRequestId': 'bidderRequestId',
    'auctionId': 'auctionId-56a2-4f71-9098-720a68f2f708'
  }],
  'start': 1487883186070,
  'auctionStart': 1487883186069,
  'timeout': 3000
};

const RESPONSE = {
  'headers': null,
  'body': {
    'id': 'responseId',
    'seatbid': [
      {
        'bid': [
          {
            'id': 'bidId1',
            'impid': 'bidId1',
            'price': 0.18,
            'adm': '<script>adm</script>',
            'adid': '144762342',
            'advertiserDomains': [
              'https://dummydomain.com'
            ],
            'iurl': 'iurl',
            'cid': '109',
            'crid': 'creativeId',
            'cat': [],
            'w': 300,
            'h': 250,
            'ext': {
              'prebid': {
                'type': 'banner'
              },
              'bidder': {
                'appnexus': {
                  'brand_id': 334553,
                  'auction_id': '514667951122925701',
                  'bidder_id': 2,
                  'bid_ad_type': 0
                }
              }
            }
          },
          {
            'id': 'bidId2',
            'impid': 'bidId2',
            'price': 0.1,
            'adm': '<script>adm2</script>',
            'adid': '144762342',
            'advertiserDomains': [
              'https://dummydomain.com'
            ],
            'iurl': 'iurl',
            'cid': '109',
            'crid': 'creativeId',
            'cat': [],
            'w': 300,
            'h': 250,
            'ext': {
              'prebid': {
                'type': 'banner'
              },
              'bidder': {
                'appnexus': {
                  'brand_id': 386046,
                  'auction_id': '517067951122925501',
                  'bidder_id': 2,
                  'bid_ad_type': 0
                }
              }
            }
          }
        ],
        'seat': 'yieldlift'
      }
    ],
    'ext': {
      'usersync': {
        'sovrn': {
          'status': 'none',
          'syncs': [
            {
              'url': 'urlsovrn',
              'type': 'iframe'
            }
          ]
        },
        'appnexus': {
          'status': 'none',
          'syncs': [
            {
              'url': 'urlappnexus',
              'type': 'pixel'
            }
          ]
        }
      },
      'responsetimemillis': {
        'appnexus': 127
      }
    }
  }
};

describe('YieldLift', function () {
  describe('isBidRequestValid', function () {
    it('should accept request if only unitId is passed', function () {
      const bid = {
        bidder: 'yieldlift',
        params: {
          unitId: 'unitId',
        }
      };
      expect(spec.isBidRequestValid(bid)).to.equal(true);
    });
    it('should accept request if only networkId is passed', function () {
      const bid = {
        bidder: 'yieldlift',
        params: {
          networkId: 'networkId',
        }
      };
      expect(spec.isBidRequestValid(bid)).to.equal(true);
    });
    it('should accept request if only publisherId is passed', function () {
      const bid = {
        bidder: 'yieldlift',
        params: {
          publisherId: 'publisherId',
        }
      };
      expect(spec.isBidRequestValid(bid)).to.equal(true);
    });

    it('reject requests without params', function () {
      const bid = {
        bidder: 'yieldlift',
        params: {}
      };
      expect(spec.isBidRequestValid(bid)).to.equal(false);
    });
  });

  describe('buildRequests', function () {
    it('creates request data', function () {
      const request = spec.buildRequests(REQUEST.bidRequest, REQUEST);

      expect(request).to.exist.and.to.be.a('object');
      const payload = JSON.parse(request.data);
      expect(payload.imp[0]).to.have.property('id', REQUEST.bidRequest[0].bidId);
      expect(payload.imp[1]).to.have.property('id', REQUEST.bidRequest[1].bidId);
    });

    it('has gdpr data if applicable', function () {
      const req = Object.assign({}, REQUEST, {
        gdprConsent: {
          consentString: 'consentString',
          gdprApplies: true,
        }
      });
      const request = spec.buildRequests(REQUEST.bidRequest, req);

      const payload = JSON.parse(request.data);
      expect(payload.user.ext).to.have.property('consent', req.gdprConsent.consentString);
      expect(payload.regs.ext).to.have.property('gdpr', 1);
    });

    it('should properly forward eids parameters', function () {
      const req = Object.assign({}, REQUEST);
      req.bidRequest[0].userIdAsEids = [
        {
          source: 'dummy.com',
          uids: [
            {
              id: 'd6d0a86c-20c6-4410-a47b-5cba383a698a',
              atype: 1
            }
          ]
        }];
      const request = spec.buildRequests(req.bidRequest, req);

      const payload = JSON.parse(request.data);
      expect(payload.user.ext.eids[0].source).to.equal('dummy.com');
      expect(payload.user.ext.eids[0].uids[0].id).to.equal('d6d0a86c-20c6-4410-a47b-5cba383a698a');
      expect(payload.user.ext.eids[0].uids[0].atype).to.equal(1);
    });
  });

  describe('interpretResponse', function () {
    it('have bids', function () {
      const bids = spec.interpretResponse(RESPONSE, REQUEST);
      expect(bids).to.be.an('array').that.is.not.empty;
      validateBidOnIndex(0);
      validateBidOnIndex(1);

      function validateBidOnIndex(index) {
        expect(bids[index]).to.have.property('currency', 'USD');
        expect(bids[index]).to.have.property('requestId', RESPONSE.body.seatbid[0].bid[index].impid);
        expect(bids[index]).to.have.property('cpm', RESPONSE.body.seatbid[0].bid[index].price);
        expect(bids[index]).to.have.property('width', RESPONSE.body.seatbid[0].bid[index].w);
        expect(bids[index]).to.have.property('height', RESPONSE.body.seatbid[0].bid[index].h);
        expect(bids[index]).to.have.property('ad', RESPONSE.body.seatbid[0].bid[index].adm);
        expect(bids[index]).to.have.property('creativeId', RESPONSE.body.seatbid[0].bid[index].crid);
        expect(bids[index].meta).to.have.property('advertiserDomains', RESPONSE.body.seatbid[0].bid[index].advertiserDomains);
        expect(bids[index]).to.have.property('ttl', 300);
        expect(bids[index]).to.have.property('netRevenue', true);
      }
    });

    it('handles empty response', function () {
      const EMPTY_RESP = Object.assign({}, RESPONSE, {'body': {}});
      const bids = spec.interpretResponse(EMPTY_RESP, REQUEST);

      expect(bids).to.be.empty;
    });
  });

  describe('getUserSyncs', function () {
    it('handles no parameters', function () {
      const opts = spec.getUserSyncs({});
      expect(opts).to.be.an('array').that.is.empty;
    });
    it('returns non if sync is not allowed', function () {
      const opts = spec.getUserSyncs({iframeEnabled: false, pixelEnabled: false});

      expect(opts).to.be.an('array').that.is.empty;
    });

    it('iframe sync enabled should return results', function () {
      const opts = spec.getUserSyncs({iframeEnabled: true, pixelEnabled: false}, [RESPONSE]);

      expect(opts.length).to.equal(1);
      expect(opts[0].type).to.equal('iframe');
      expect(opts[0].url).to.equal(RESPONSE.body.ext.usersync['sovrn'].syncs[0].url);
    });

    it('pixel sync enabled should return results', function () {
      const opts = spec.getUserSyncs({iframeEnabled: false, pixelEnabled: true}, [RESPONSE]);

      expect(opts.length).to.equal(1);
      expect(opts[0].type).to.equal('image');
      expect(opts[0].url).to.equal(RESPONSE.body.ext.usersync['appnexus'].syncs[0].url);
    });

    it('all sync enabled should return all results', function () {
      const opts = spec.getUserSyncs({iframeEnabled: true, pixelEnabled: true}, [RESPONSE]);

      expect(opts.length).to.equal(2);
    });
  });
});
