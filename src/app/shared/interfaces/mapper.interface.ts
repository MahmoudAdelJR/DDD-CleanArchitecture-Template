export interface Mapper<TSource, TTarget> {
  map(source: TSource): TTarget;
}

export interface BiMapper<TDto, TDomain> {
  toDomain(dto: TDto): TDomain;
  toDto(domain: TDomain): TDto;
}