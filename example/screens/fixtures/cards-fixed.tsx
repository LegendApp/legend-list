import Cards from "~/components/Cards";
import { FIXED_CARD_ITEM_SIZE } from "~/screens/fixtures/shared/cardsRenderItem";

export default function CardsFixedRoute() {
    return <Cards fixedItemSize={FIXED_CARD_ITEM_SIZE} />;
}
