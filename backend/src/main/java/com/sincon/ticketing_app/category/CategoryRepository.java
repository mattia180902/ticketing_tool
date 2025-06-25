package com.sincon.ticketing_app.category;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.*;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {

    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.category.id = :categoryId")
    Long countTickets(@Param("categoryId") Long categoryId);

    @Query("""
        SELECT c FROM Category c
        """)
    Page<Category> findAllCategories(Pageable pageable);

    boolean existsByName(String name);
}