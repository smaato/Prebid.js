import * as utils from '../src/utils.js';
import { registerBidder } from '../src/adapters/bidderFactory.js';
import { config } from '../src/config.js';
import { BANNER } from '../src/mediaTypes.js';

const BIDDER_CODE = 'smaato';
const SMAATO_ENDPOINT = 'https://prebid-test.smaatolabs.net/bidder';
const CLIENT = 'prebid/js/$prebid.version$_0.1'

/**
* Transform BidRequest to OpenRTB-formatted BidRequest Object
* @param {Array<BidRequest>} validBidRequests
* @param {any} bidderRequest
* @returns {string}
*/
const buildOpenRtbBidRequestPayload = (validBidRequests, bidderRequest) => {
  /**
   * Turn incoming prebid sizes into openRtb format mapping.
   * @param {*} sizes in format [[10, 10], [20, 20]]
   * @returns array of openRtb format mappings [{w: 10, h: 10}, {w: 20, h: 20}]
   */
  const parseSizes = (sizes) => {
    return sizes.map((size) => {
      return {w: size[0], h: size[1]};
    })
  }

  const imp = validBidRequests.map(br => {
    const sizes = parseSizes(utils.getAdUnitSizes(br));
    return {
      id: br.bidId,
      banner: {
        w: sizes[0].w,
        h: sizes[0].h,
        format: sizes
      },
      tagid: utils.deepAccess(br, 'params.adspaceId')
    };
  });

  const request = {
    id: bidderRequest.auctionId,
    at: 1,
    imp,
    cur: ['USD'],
    site: {
      id: window.location.hostname,
      publisher: {
        id: utils.deepAccess(validBidRequests[0], 'params.publisherId')
      },
      domain: window.location.hostname,
      page: window.location.href,
      ref: bidderRequest.refererInfo.referer
    },
    device: {
      language: (navigator && navigator.language) ? navigator.language.split('-')[0] : '',
      ua: navigator.userAgent,
      dnt: utils.getDNT() ? 1 : 0,
      h: screen.height,
      w: screen.width
    },
    regs: {
      coppa: config.getConfig('coppa') === true ? 1 : 0,
      ext: {
        gdpr: bidderRequest.gdprConsent && bidderRequest.gdprConsent.gdprApplies ? 1 : 0,
      }
    },
    ext: {
      client: CLIENT
    }
  };

  if (bidderRequest.uspConsent !== undefined) {
    utils.deepSetValue(request, 'regs.ext.us_privacy', bidderRequest.uspConsent);
  }

  utils.logInfo('[SMAATO] OpenRTB Request:', request);
  return JSON.stringify(request);
}

export const spec = {
  code: BIDDER_CODE,
  supportedMediaTypes: [BANNER],

  /**
      * Determines whether or not the given bid request is valid.
      *
      * @param {BidRequest} bid The bid params to validate.
      * @return boolean True if this is a valid bid, and false otherwise.
      */
  isBidRequestValid: (bid) => {
    return typeof bid.params === 'object' &&
           typeof bid.params.publisherId === 'string' &&
           typeof bid.params.adspaceId === 'string';
  },

  /**
      * Make a server request from the list of BidRequests.
      *
      * @param {validBidRequests[]} - an array of bids
      * @return ServerRequest Info describing the request to the server.
      */
  buildRequests: (validBidRequests, bidderRequest) => {
    utils.logInfo('[SMAATO] Client version:', CLIENT);
    return {
      method: 'POST',
      url: validBidRequests[0].params.endpoint || SMAATO_ENDPOINT,
      data: buildOpenRtbBidRequestPayload(validBidRequests, bidderRequest),
      options: {
        customHeaders: {
          'X-SMT-Client': CLIENT,
          'X-SMT-SessionId': bidderRequest.auctionId
        }
      }
    };
  },
  /**
      * Unpack the response from the server into a list of bids.
      *
      * @param {ServerResponse} serverResponse A successful response from the server.
      * @return {Bid[]} An array of bids which were nested inside the server.
      */
  interpretResponse: (serverResponse, bidRequest) => {
    // const serverBody  = serverResponse.body;
    let serverResponseHeaders = serverResponse.headers;
    const smtAdType = serverResponseHeaders.get('X-SMT-ADTYPE');

    const smtExpires = serverResponseHeaders.get('X-SMT-Expires');
    let ttlSec = 300;

    if (smtExpires !== undefined) {
      ttlSec = Math.floor((smtExpires - Date.now()) / 1000);
    }

    const res = serverResponse.body;

    utils.logInfo('[SMAATO] OpenRTB Response:', res);

    var bids = []
    if (res) {
      res.seatbid.forEach(sb => {
        sb.bid.forEach(b => {
          let ad = '';
          switch (smtAdType) {
            case 'Img':
              ad = createImgAd(b.adm);
              break;
            case 'Richmedia':
              ad = createRichmediaAd(b.adm);
              break;
            case 'Video':
            default:
              ad = '';
          }

          if (ad !== '') {
            bids.push({
              requestId: b.impid,
              cpm: b.price || 0,
              width: b.w,
              height: b.h,
              ad: ad,
              ttl: ttlSec,
              creativeId: b.crid,
              dealId: b.dealid || null,
              netRevenue: false,
              currency: res.cur
            })
          }
        })
      });
    }

    utils.logInfo('[SMAATO] Prebid bids:', bids);
    return bids;
  },

  /**
      * Register the user sync pixels which should be dropped after the auction.
      *
      * @param {SyncOptions} syncOptions Which user syncs are allowed?
      * @param {ServerResponse[]} serverResponses List of server's responses.
      * @return {UserSync[]} The user syncs which should be dropped.
      */
  getUserSyncs: (syncOptions, serverResponses, gdprConsent, uspConsent) => {
    const syncs = []
    return syncs;
  }
}
registerBidder(spec);

const createImgAd = (adm) => {
  const image = JSON.parse(adm).image;

  let clickEvent = '';
  image.clicktrackers.forEach(src => {
    clickEvent += `fetch(decodeURIComponent('${encodeURIComponent(src)}'), {cache: 'no-cache'});`;
  })

  let markup = `<div onclick="${clickEvent}"><a href="${image.img.ctaurl}"><img src="${image.img.url}" width="${image.img.w}" height="${image.img.h}"/></a></div>`;

  image.impressiontrackers.forEach(src => {
    markup += `<img src="${src}" alt="" width="0" height="0"/>`;
  });

  return markup;
}

const createRichmediaAd = (adm) => {
  const rich = JSON.parse(adm).richmedia.mediadata;
  return rich.content;
}
