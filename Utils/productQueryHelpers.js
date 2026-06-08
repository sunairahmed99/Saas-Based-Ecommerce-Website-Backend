/** Shared MongoDB projections for fast product list/detail queries. */

export const PRODUCT_LIST_SELECT =
  "pname pprice pactualprice pdis prodisprice pstatus totalStock pqty views rating reviewCount pimage1 catid subcatid sellerid createdAt isFeatured";

export const PRODUCT_LIST_POPULATE = [
  { path: "sellerid", select: "name sname shopName" },
  { path: "catid", select: "name cname Image" },
  { path: "subcatid", select: "name scname Image" },
];

export const PRODUCT_DETAIL_POPULATE = [
  { path: "sellerid", select: "name sname shopName email" },
  { path: "catid", select: "name cname Image" },
  { path: "subcatid", select: "name scname Image" },
];

export function applyProductListQuery(query) {
  return query.select(PRODUCT_LIST_SELECT).populate(PRODUCT_LIST_POPULATE).lean();
}

export function applyProductDetailQuery(query) {
  return query.populate(PRODUCT_DETAIL_POPULATE).lean();
}
