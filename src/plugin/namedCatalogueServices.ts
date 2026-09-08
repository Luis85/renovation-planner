import type { EntityId } from '../core/identity/EntityId';
import type { EventBus } from '../core/events/EventBus';
import type { Logger } from '../application/ports/Logger';
import { guardCommand } from '../application/errors/guardAgainstThrowing';
import { namedCatalogueServices, type NamedCatalogueCreate, type NamedCatalogueSource, type NamedCatalogueServices } from '../application/commands/catalogue/NamedCatalogueServices';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';

export function guardedNamedCatalogue<T extends { readonly id: EntityId<string>; readonly name: string }>(source: NamedCatalogueSource<T>, events: EventBus, logger: Logger): NamedCatalogueServices<T> {
 const services = namedCatalogueServices(source, events);
 const list = guardCommand({ execute: () => services.list() }, source.kind + '.list-failed', logger, VAULT_EXCEPTION_MAPPER);
 const create = guardCommand({ execute: (input: NamedCatalogueCreate) => services.create(input) }, source.kind + '.create-failed', logger, VAULT_EXCEPTION_MAPPER);
 return { list: () => list.execute(undefined), create: name => create.execute(name), onChanged: listener => services.onChanged(listener) };
}
